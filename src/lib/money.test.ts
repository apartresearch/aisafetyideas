import { describe, it, expect } from 'vitest';
import { formatCents } from './money';

describe('formatCents', () => {
  it('formats cents as USD currency', () => {
    expect(formatCents(3712)).toBe('$37.12');
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(100000)).toBe('$1,000.00');
  });
  it('renders an em-dash for null/undefined', () => {
    expect(formatCents(null)).toBe('—');
    expect(formatCents(undefined)).toBe('—');
  });
  it('honors a currency argument', () => {
    expect(formatCents(500, 'EUR')).toBe('€5.00');
  });
});
