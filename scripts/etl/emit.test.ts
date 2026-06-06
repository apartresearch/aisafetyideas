import { describe, it, expect } from 'vitest';
import { buildDocument } from './emit';

describe('buildDocument', () => {
  it('wraps in a transaction, brackets the load with session_replication_role, and ends with assertions', () => {
    const doc = buildDocument({
      authUsers: [{ id: '11111111-1111-1111-1111-111111111111' }] as any,
      identities: [],
      users: [],
      ideas: [],
      categories: [],
      ideaCats: [],
      ideaRels: []
    } as any);
    expect(doc.startsWith('begin;')).toBe(true);
    // NOT the ALTER TABLE form (postgres can't own auth.users); uses the SET that needs no ownership
    expect(doc).not.toContain('disable trigger');
    expect(doc).toContain('set session_replication_role = replica;');
    expect(doc).toContain('set session_replication_role = origin;');
    const replicaAt = doc.indexOf('set session_replication_role = replica;');
    const authInsertAt = doc.indexOf('insert into auth.users');
    const originAt = doc.indexOf('set session_replication_role = origin;');
    expect(replicaAt).toBeGreaterThanOrEqual(0);
    expect(replicaAt).toBeLessThan(authInsertAt); // replica set before the auth import
    expect(authInsertAt).toBeLessThan(originAt); // origin restored after the load, before commit
    expect(doc).toMatch(/do \$\$[\s\S]*assert[\s\S]*\$\$/); // count + FK assertion block
    expect(doc).toContain('orphan idea.author_id'); // FK integrity asserted (FK checks were deferred)
    expect(originAt).toBeLessThan(doc.indexOf('do $$')); // origin restored before the assertions
    expect(doc.trim().endsWith('commit;')).toBe(true);
  });

  it('orders inserts in dependency order and uses the right conflict targets', () => {
    const doc = buildDocument({
      authUsers: [{ id: "'a'" }],
      identities: [{ id: "'i'" }],
      users: [{ id: "'u'" }],
      experts: [{ id: "'e'" }],
      ideas: [{ legacy_id: "'1'" }],
      categories: [{ legacy_id: "'2'" }],
      ideaCats: [{ idea_id: "'x'", category_id: "'y'" }],
      ideaRels: [{ legacy_id: "'3'", parent_id: "'p'", child_id: "'c'" }]
    });

    // dependency order: auth.users → auth.identities → profiles → experts → categories → ideas → idea_categories → idea_relations
    const order = [
      'insert into auth.users',
      'insert into auth.identities',
      'insert into public.profiles',
      'insert into public.experts',
      'insert into public.categories',
      'insert into public.ideas',
      'insert into public.idea_categories',
      'insert into public.idea_relations'
    ].map((s) => doc.indexOf(s));
    expect(order.every((n) => n >= 0)).toBe(true);
    for (let k = 1; k < order.length; k++) expect(order[k - 1]).toBeLessThan(order[k]);

    // conflict targets
    expect(doc).toContain('on conflict (id) do nothing'); // auth/profiles/experts
    expect(doc).toContain('on conflict (legacy_id) do nothing'); // categories/ideas
    expect(doc).toContain('on conflict (idea_id, category_id) do nothing');
    expect(doc).toContain('on conflict (parent_id, child_id) do nothing');

    // session_replication_role is restored to origin AFTER all inserts (incl. categories/ideas/relations)
    expect(doc.indexOf('insert into public.idea_relations'))
      .toBeLessThan(doc.indexOf('set session_replication_role = origin;'));
  });

  it('uses >= in the assertions so re-runs and the pre-existing test row do not trip them', () => {
    const doc = buildDocument({
      authUsers: [],
      identities: [],
      users: [],
      ideas: [],
      categories: [],
      ideaCats: [],
      ideaRels: []
    });
    expect(doc).toMatch(/assert \(select count\(\*\) from public\.ideas\) >= \d+/);
    expect(doc).toMatch(/assert \(select count\(\*\) from public\.profiles\) >= \d+/);
    expect(doc).not.toContain('assert (select count(*) from public.ideas) = ');
  });
});
