import { describe, it, expect } from 'vitest';
import { load } from './+page.server';

function mkLocals(rows: unknown[], totals: unknown[] = []) {
  const make = (table: string): any => {
    if (table === 'idea_vote_totals') return { select: () => Promise.resolve({ data: totals }) };
    // enrichCards reads answers/comments via .select(...).in(...) — return no stats
    if (table === 'answers' || table === 'comments') {
      return { select: () => ({ in: () => Promise.resolve({ data: [] }) }) };
    }
    // thenable builder: serves both `…order().range()` (new) and a directly-awaited `…order()` (top)
    const result = { data: rows, count: rows.length };
    const builder: any = {
      select() { return this; }, neq() { return this; }, not() { return this; }, eq() { return this; },
      order() { return this; }, in() { return this; },
      range() { return Promise.resolve(result); },
      then(resolve: any, reject: any) { return Promise.resolve(result).then(resolve, reject); }
    };
    return builder;
  };
  return { supabase: { from: (t: string) => make(t) } } as any;
}

describe('ideas browse load', () => {
  it('returns ideas + count with scores attached', async () => {
    const res = (await load({
      url: new URL('http://x/ideas'),
      locals: mkLocals([{ id: '1', title: 'A' }], [{ idea_id: '1', score: 3 }])
    } as any)) as any;
    expect(res.ideas).toEqual([
      { id: '1', title: 'A', score: 3, answerCount: 0, commentCount: 0, verified: null }
    ]);
    expect(res.count).toBe(1);
  });
  it('sort=top ranks by score desc', async () => {
    const res = (await load({
      url: new URL('http://x/ideas?sort=top'),
      locals: mkLocals(
        [{ id: '1', created_at: '2024-01-02' }, { id: '2', created_at: '2024-01-01' }],
        [{ idea_id: '2', score: 9 }]
      )
    } as any)) as any;
    expect(res.ideas.map((i: any) => i.id)).toEqual(['2', '1']);
  });
});
