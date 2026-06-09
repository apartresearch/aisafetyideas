/**
 * Pure fee-math helpers. No side effects, no imports - safe to call anywhere.
 *
 * Fee is expressed in basis points (bps): 450 bps = 4.5%.
 * Floor the fee so the platform never over-charges and net + fee === amount exactly.
 */
export function splitFee(
  amountCents: number,
  feeBps: number
): { feeCents: number; netCents: number } {
  const feeCents = Math.floor((amountCents * feeBps) / 10000);
  return { feeCents, netCents: amountCents - feeCents };
}
