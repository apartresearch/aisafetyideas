import type { SupabaseClient } from '@supabase/supabase-js';

export type PlatformConfig = {
  feeBps: number;
  fundingEnabled: boolean;
  minWithdrawalCents: number;
};

const SAFE_DEFAULTS: PlatformConfig = {
  feeBps: 450,
  fundingEnabled: false,
  minWithdrawalCents: 100
};

/**
 * Read the single platform_config row.
 * Falls back to safe defaults if the row is somehow missing (should never happen
 * in production - the migration seeds it - but guards against a broken state).
 */
export async function getPlatformConfig(supabase: SupabaseClient): Promise<PlatformConfig> {
  const { data, error } = await supabase
    .from('platform_config')
    .select('fee_bps, funding_enabled, min_withdrawal_cents')
    .eq('id', true)
    .single();

  if (error || !data) return SAFE_DEFAULTS;

  return {
    feeBps: data.fee_bps,
    fundingEnabled: data.funding_enabled,
    minWithdrawalCents: data.min_withdrawal_cents
  };
}
