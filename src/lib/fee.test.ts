import { describe, it, expect } from 'vitest';
import { splitFee } from './fee';

describe('splitFee', () => {
  it('standard: splitFee(10000, 450) → { feeCents: 450, netCents: 9550 }', () => {
    expect(splitFee(10000, 450)).toEqual({ feeCents: 450, netCents: 9550 });
  });

  it('zero fee: splitFee(x, 0) → { feeCents: 0, netCents: x }', () => {
    expect(splitFee(10000, 0)).toEqual({ feeCents: 0, netCents: 10000 });
    expect(splitFee(1, 0)).toEqual({ feeCents: 0, netCents: 1 });
    expect(splitFee(0, 0)).toEqual({ feeCents: 0, netCents: 0 });
  });

  it('rounding: splitFee(101, 450) → feeCents: 4 (floor of 4.545), netCents: 97', () => {
    expect(splitFee(101, 450)).toEqual({ feeCents: 4, netCents: 97 });
  });

  it('fuzz: feeCents + netCents === amountCents for many inputs', () => {
    const bpsValues = [0, 1, 100, 250, 450, 999, 1000, 1999, 2000];
    for (let amount = 0; amount <= 200; amount++) {
      for (const bps of bpsValues) {
        const { feeCents, netCents } = splitFee(amount, bps);
        expect(feeCents + netCents).toBe(amount);
        expect(feeCents).toBeGreaterThanOrEqual(0);
        expect(netCents).toBeGreaterThanOrEqual(0);
      }
    }
    // also check large amounts
    for (const amount of [9999, 10000, 10001, 99999, 100000, 1000000]) {
      for (const bps of bpsValues) {
        const { feeCents, netCents } = splitFee(amount, bps);
        expect(feeCents + netCents).toBe(amount);
        expect(feeCents).toBeGreaterThanOrEqual(0);
        expect(netCents).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
