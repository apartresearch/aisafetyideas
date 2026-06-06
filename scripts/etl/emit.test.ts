import { describe, it, expect } from 'vitest';
import {
  buildDocument, buildDocumentV2,
  AUTH_USERS_COLUMNS, AUTH_IDENTITIES_COLUMNS, PROFILES_COLUMNS, EXPERTS_COLUMNS,
  CATEGORIES_COLUMNS, IDEAS_COLUMNS, IDEA_CATEGORIES_COLUMNS, IDEA_RELATIONS_COLUMNS,
  COMMENTS_COLUMNS, INTEREST_COLUMNS, ANSWERS_COLUMNS, ARTIFACTS_COLUMNS, VOTES_COLUMNS
} from './emit';

/** Fill all columns from `cols` with NULL, overriding with provided values. */
const fill = (cols: readonly string[], overrides: Record<string, string>): Record<string, string> =>
  Object.fromEntries(cols.map((c) => [c, overrides[c] ?? 'NULL']));

describe('buildDocument', () => {
  it('wraps in a transaction, brackets the load with session_replication_role, and ends with assertions', () => {
    const doc = buildDocument({
      authUsers: [fill(AUTH_USERS_COLUMNS, { id: "'11111111-1111-1111-1111-111111111111'" })],
      identities: [],
      users: [],
      ideas: [],
      categories: [],
      ideaCats: [],
      ideaRels: []
    });
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
      authUsers: [fill(AUTH_USERS_COLUMNS, { id: "'a'" })],
      identities: [fill(AUTH_IDENTITIES_COLUMNS, { id: "'i'" })],
      users: [fill(PROFILES_COLUMNS, { id: "'u'" })],
      experts: [fill(EXPERTS_COLUMNS, { id: "'e'" })],
      ideas: [fill(IDEAS_COLUMNS, { legacy_id: "'1'" })],
      categories: [fill(CATEGORIES_COLUMNS, { legacy_id: "'2'" })],
      ideaCats: [fill(IDEA_CATEGORIES_COLUMNS, { idea_id: "'x'", category_id: "'y'" })],
      ideaRels: [fill(IDEA_RELATIONS_COLUMNS, { legacy_id: "'3'", parent_id: "'p'", child_id: "'c'" })]
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

describe('buildDocumentV2', () => {
  const data = {
    comments: [fill(COMMENTS_COLUMNS, { legacy_id: "'96'", idea_id: '(select 1)', author_id: 'NULL', body_md: "''", legacy: "'{}'::jsonb", created_at: 'now()' })],
    replies: [{ legacy_id: '96', reply_legacy_id: '69' }],
    interest: [fill(INTEREST_COLUMNS, { legacy_id: "'14'", idea_id: '(select 1)', profile_id: 'NULL', note_md: 'NULL', legacy: "'{}'::jsonb", created_at: 'now()' })],
    answers: [fill(ANSWERS_COLUMNS, { legacy_id: "'3'", idea_id: '(select 1)', submitter_id: 'NULL', title: "''", explanation_md: 'NULL', status: "'pending'", verified_at: 'NULL', legacy: "'{}'::jsonb", created_at: 'now()' })],
    artifacts: [fill(ARTIFACTS_COLUMNS, { legacy_id: "'3'", answer_id: '(select 1)', kind: "'url'", url: "''", created_at: 'now()' })],
    votes: [fill(VOTES_COLUMNS, { legacy_id: "'7'", idea_id: '(select 1)', profile_id: 'NULL', value: '1', legacy: "'{}'::jsonb", created_at: 'now()' })]
  };

  it('wraps in a transaction with the replica bracket and ends with assertions', () => {
    const doc = buildDocumentV2(data);
    expect(doc.startsWith('begin;')).toBe(true);
    expect(doc).toContain('set session_replication_role = replica;');
    expect(doc).toContain('set session_replication_role = origin;');
    expect(doc).toMatch(/do \$\$[\s\S]*assert[\s\S]*\$\$/);
    expect(doc).toContain('orphan comment author');
    expect(doc).toContain('orphan reply_to');
    expect(doc.trim().endsWith('commit;')).toBe(true);
  });

  it('orders inserts comments → replies-update → interest → answers → artifacts → votes', () => {
    const doc = buildDocumentV2(data);
    const order = [
      'insert into public.comments',
      'update public.comments',
      'insert into public.interest',
      'insert into public.answers',
      'insert into public.answer_artifacts',
      'insert into public.idea_votes'
    ].map((s) => doc.indexOf(s));
    expect(order.every((n) => n >= 0)).toBe(true);
    for (let k = 1; k < order.length; k++) expect(order[k - 1]).toBeLessThan(order[k]);
  });

  it('emits idempotent reply updates guarded by "reply_to is null"', () => {
    const doc = buildDocumentV2(data);
    expect(doc).toContain(
      'update public.comments c set reply_to = (select p.id from public.comments p where p.legacy_id = 69)\n' +
      'where c.legacy_id = 96 and c.reply_to is null;'
    );
  });

  it('arbitrates ALL unique constraints on interest/votes (targetless) and legacy_id elsewhere', () => {
    const doc = buildDocumentV2(data);
    const seg = (from: string, to: string) => doc.slice(doc.indexOf(from), doc.indexOf(to));
    // comments/answers/artifacts: legacy_id is their only unique key
    expect(seg('insert into public.comments', 'update public.comments')).toContain('on conflict (legacy_id) do nothing;');
    // interest/idea_votes ALSO carry unique (idea_id, profile_id): an organic post-restore row on the
    // same pair must NOT abort the load — a targetless `on conflict do nothing` arbitrates ANY unique index
    expect(seg('insert into public.interest', 'insert into public.answers')).toContain('on conflict do nothing;');
    expect(seg('insert into public.interest', 'insert into public.answers')).not.toContain('on conflict (');
    expect(seg('insert into public.idea_votes', 'set session_replication_role = origin')).toContain('on conflict do nothing;');
    expect(seg('insert into public.idea_votes', 'set session_replication_role = origin')).not.toContain('on conflict (');
  });

  it('asserts legacy-scoped counts where exact, totals where displacement is possible', () => {
    const doc = buildDocumentV2(data);
    // comments/answers/artifacts can't be displaced → exact legacy-scoped counts (organic-immune)
    expect(doc).toMatch(/assert \(select count\(\*\) from public\.comments where legacy_id is not null\) >= \d+/);
    expect(doc).toMatch(/assert \(select count\(\*\) from public\.answers where legacy_id is not null\) >= \d+/);
    // interest/votes: an organic row on the same (idea_id, profile_id) DISPLACES the legacy insert,
    // so legacy-scoped counts could undershoot — assert totals (legacy + displacing organic ≥ source)
    expect(doc).toMatch(/assert \(select count\(\*\) from public\.idea_votes\) >= \d+/);
    expect(doc).toMatch(/assert \(select count\(\*\) from public\.interest\) >= \d+/);
    expect(doc).toContain('orphan comment idea');   // full spec §5 orphan-scan list
    expect(doc).toContain('orphan artifact answer');
  });
});
