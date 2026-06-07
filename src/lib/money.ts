/** Format integer cents as a localized currency string; null/undefined → em-dash. */
export function formatCents(cents: number | null | undefined, currency = 'USD'): string {
  return cents == null
    ? '—'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}
