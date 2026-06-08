import { describe, it, expect } from 'vitest';
import { CritiqueRoundSchema, REVIEWERS } from './critique';
describe('critique schema', () => {
  it('accepts a well-formed round and exposes the 4 reviewers', () => {
    expect(REVIEWERS.map((r) => r.key)).toEqual(['skeptic', 'methods', 'impact', 'clarifying']);
    const ok = CritiqueRoundSchema.safeParse({
      reviewers: [{ persona: 'skeptic', comments: ['weak baseline'], questions: ['what control?'] }]
    });
    expect(ok.success).toBe(true);
  });
  it('rejects a malformed round', () => {
    expect(CritiqueRoundSchema.safeParse({ reviewers: [{ persona: 'x' }] }).success).toBe(false);
  });
});
