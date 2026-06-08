import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Bucket NAMES only. The limit VALUES are authoritative in the SQL function
 * `public.consume_rate_limit` (its CASE) — keep this list in sync with that CASE; a bucket here
 * but not there raises at runtime (caught by fail-open + log), and vice-versa is a dead name.
 * `login` is intentionally absent — it's the in-memory limiter below, not a DB bucket.
 */
export const BUCKETS = [
  'comment', 'comment_delete', 'engage', 'pledge', 'answer',
  'idea_create', 'review', 'profile', 'admin', 'ai_generate'
] as const;
export type Bucket = (typeof BUCKETS)[number];

/** Shared 429 copy for the authed buckets (login uses its own message). */
export const RATE_LIMIT_MESSAGE = 'Slow down — try again in a moment.';

/**
 * DB-backed limiter for AUTHED mutations. Calls the SECURITY DEFINER RPC with the caller's own
 * `locals.supabase` client; the function (owned by postgres) self-keys on auth.uid() and looks
 * up the limit server-side — no service-role CLIENT involved. FAILS OPEN on RPC error: a limiter
 * outage must never take the site down; the spam risk is bounded, the availability risk is not.
 */
export async function rateLimit(
  supabase: SupabaseClient<any>,
  bucket: Bucket
): Promise<{ ok: boolean }> {
  const { data, error } = await supabase.rpc('consume_rate_limit', { p_bucket: bucket });
  if (error) {
    console.error(`rate-limit rpc failed (fail-open) bucket=${bucket}: ${error.message}`);
    return { ok: true };
  }
  return { ok: data !== false };
}

// ── login limiter: in-memory, per-IP, BEST-EFFORT. The DB cannot key anon callers without trusting
// spoofable input; getClientAddress() derives from a client-influenced x-forwarded-for and the map is
// per-fluid-compute-instance (real cap ≈ 10 × instances, resets on cold start). NOT anti-spoof —
// Supabase Auth's own email limits are the real backstop; this just blunts casual repeat-submits. ──
const LOGIN = { max: 10, windowMs: 15 * 60_000 };
let loginHits = new Map<string, number[]>();

/** True when this IP has exceeded the login window. `now` is injectable for tests. */
export function loginLimited(ip: string, now: number = Date.now()): boolean {
  const cutoff = now - LOGIN.windowMs;
  const hits = (loginHits.get(ip) ?? []).filter((t) => t > cutoff);
  hits.push(now);
  loginHits.set(ip, hits);
  if (loginHits.size > 10_000) {
    for (const [k, v] of loginHits) if (!v.some((t) => t > cutoff)) loginHits.delete(k);
  }
  return hits.length > LOGIN.max;
}

/** Test hook only. */
export function __resetLoginLimiter() {
  loginHits = new Map();
}
