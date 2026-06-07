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
  it('maps legacy currency symbols to ISO codes (never throws)', () => {
    // legacy ETL rows store "$" — Intl.NumberFormat would throw RangeError and 500 the page
    expect(formatCents(3712, '$')).toBe('$37.12');
    expect(formatCents(500, '€')).toBe('€5.00');
  });
  it('falls back to USD for an unrecognized/garbage currency code', () => {
    expect(formatCents(3712, 'not-a-code')).toBe('$37.12');
    expect(formatCents(3712, '')).toBe('$37.12');
  });
});
