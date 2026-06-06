import { describe, it, expect } from 'vitest';
import { attachScores, sortTop } from './votes';

describe('votes helpers', () => {
  it('attachScores joins totals onto ideas, defaulting 0', () => {
    const out = attachScores(
      [{ id: 'a' }, { id: 'b' }],
      [{ idea_id: 'b', score: 5 }]
    );
    expect(out).toEqual([{ id: 'a', score: 0 }, { id: 'b', score: 5 }]);
  });
  it('sortTop orders by score desc, then created_at desc', () => {
    const out = sortTop([
      { id: 'a', score: 1, created_at: '2024-01-01' },
      { id: 'b', score: 5, created_at: '2023-01-01' },
      { id: 'c', score: 1, created_at: '2025-01-01' }
    ]);
    expect(out.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });
});
