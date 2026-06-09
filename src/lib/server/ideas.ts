import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when the route param is a raw UUID (a legacy /ideas/<uuid> URL) rather than a slug. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Which `ideas` column an /ideas/<param> URL addresses: legacy UUID URLs hit `id`, slugs hit `slug`. */
export function ideaParamColumn(param: string): 'id' | 'slug' {
  return isUuid(param) ? 'id' : 'slug';
}

/**
 * Resolve an /ideas/<param> route param to the idea's UUID, for form actions that write rows
 * keyed by idea_id. Returns null if no idea matches (caller should fail/404).
 * RLS still governs the subsequent write - this only maps the public URL to a primary key.
 */
export async function resolveIdeaId(
  supabase: SupabaseClient,
  param: string
): Promise<string | null> {
  if (isUuid(param)) return param;
  const { data } = await supabase.from('ideas').select('id').eq('slug', param).maybeSingle();
  return data?.id ?? null;
}
