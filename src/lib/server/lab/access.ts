import type { SupabaseClient } from '@supabase/supabase-js';

/** True if the caller may use AI Lab tools (admin · approved expert · active monthly supporter). */
export async function canUseLabAi(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_use_lab_ai');
  return !error && data === true;
}
