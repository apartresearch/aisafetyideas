import { describe, it, expect } from 'vitest';
import { barPercents } from './funding';

describe('barPercents', () => {
  it('scales to the max', () => expect(barPercents([50, 100, 25])).toEqual([50, 100, 25]));
  it('handles a non-100 max', () => expect(barPercents([1, 2, 4])).toEqual([25, 50, 100]));
  it('all-zero → all 0', () => expect(barPercents([0, 0])).toEqual([0, 0]));
  it('empty → empty', () => expect(barPercents([])).toEqual([]));
});
