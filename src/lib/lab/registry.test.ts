import { describe, it, expect } from 'vitest';
import { EXPANSIONS } from './registry';
describe('expansion registry', () => {
  it('has the ready tools and marks future ones coming-soon', () => {
    const byKey = Object.fromEntries(EXPANSIONS.map((e) => [e.key, e]));
    expect(byKey['copy_agent'].status).toBe('ready');
    expect(byKey['review'].gated).toBe(true);
    expect(byKey['github'].status).toBe('soon');
  });
});
