/** Normalise a series of values to integer bar widths (0–100% of the max). Empty/all-zero → all 0. */
export function barPercents(values: number[]): number[] {
  const max = values.length ? Math.max(0, ...values) : 0;
  if (max <= 0) return values.map(() => 0);
  return values.map((v) => Math.max(0, Math.round((v / max) * 100)));
}
