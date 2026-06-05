import { describe, it, expect } from 'vitest';
import { load } from './+page.server';

function mkLocals(rows: unknown[]) {
  const builder: any = {
    select() { return this; }, neq() { return this; }, order() { return this; }, eq() { return this; },
    range() { return Promise.resolve({ data: rows, count: rows.length }); }
  };
  return { supabase: { from: () => builder } } as any;
}

describe('ideas browse load', () => {
  it('returns ideas + count', async () => {
    const res = (await load({ url: new URL('http://x/ideas'), locals: mkLocals([{ id: '1', title: 'A' }]) } as any)) as any;
    expect(res.ideas.length).toBe(1);
    expect(res.count).toBe(1);
  });
});
