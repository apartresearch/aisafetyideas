// Map currency symbols / common aliases (seen in legacy ETL data) to ISO 4217 codes.
const CURRENCY_ALIASES: Record<string, string> = {
  $: 'USD',
  US$: 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY'
};

/** Coerce arbitrary stored currency values to a usable ISO 4217 code; defaults to USD. */
function normalizeCurrency(currency: string): string {
  const raw = (currency ?? '').trim();
  if (CURRENCY_ALIASES[raw]) return CURRENCY_ALIASES[raw];
  return /^[A-Za-z]{3}$/.test(raw) ? raw.toUpperCase() : 'USD';
}

/**
 * Format integer cents as a localized currency string; null/undefined → em-dash.
 * Hardened against bad stored currency codes: legacy ETL rows carry values like "$", which
 * would make `Intl.NumberFormat` throw `RangeError: Invalid currency code` and 500 the page.
 * We normalize known symbols and fall back to USD for anything not a valid ISO code.
 */
export function formatCents(cents: number | null | undefined, currency = 'USD'): string {
  if (cents == null) return '—';
  const code = normalizeCurrency(currency);
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(cents / 100);
  } catch {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  }
}
