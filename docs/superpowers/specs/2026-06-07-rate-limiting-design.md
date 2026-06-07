# App-wide Rate Limiting (design)

**Date:** 2026-06-07 · **Status:** approved by owner (this session)
**Closes:** spec §9 of `2026-06-04-aisafetyideas-overhaul-design.md` ("rate-limit submit/donate
endpoints") — the last Phase-1 security gap. Current state: no throttling anywhere; only inline
length caps (comment 10k, interest note 2k).

## 1. Decisions (owner-confirmed)

1. **Mechanism: Postgres-backed fixed-window counter** — exact across all Vercel fluid-compute
   instances, version-controlled with the schema, pgTAP-testable. +1 DB round-trip per mutation
   (mutations are rare; negligible). Rejected: in-memory token bucket (per-instance on fluid
   compute → limits multiply by instance count, reset on cold start); Vercel WAF rules
   (dashboard config drifts from the repo, IP-keyed only, untestable in CI).
2. **Login endpoints included** — per-IP, belt-and-suspenders over Supabase Auth's own email
   limits (anti link-spam/enumeration).
3. **Lenient launch posture** — caps only a script would hit; tighten later from data.

## 2. Schema (one migration: `rate_limits`)

```sql
create table public.rate_limits (
  key          text not null,         -- 'user:<uuid>' | 'ip:<addr>'
  bucket       text not null,         -- endpoint family, e.g. 'comment'
  window_start timestamptz not null,  -- aligned to the bucket's window size
  count        int  not null default 1,
  primary key (key, bucket, window_start)
);
alter table public.rate_limits enable row level security;
-- ZERO policies: deny-by-default for every client role. Only the RPC below touches it.
```

```sql
create function public.consume_rate_limit(
  p_key text, p_bucket text, p_max int, p_window_secs int
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_secs) * p_window_secs);
  v_count int;
begin
  -- opportunistic cleanup: this bucket's rows older than two windows (keeps the table tiny; no cron)
  delete from public.rate_limits
    where bucket = p_bucket and window_start < now() - make_interval(secs => 2 * p_window_secs);

  insert into public.rate_limits as r (key, bucket, window_start)
    values (p_key, p_bucket, v_window)
    on conflict (key, bucket, window_start)
    do update set count = r.count + 1
    returning count into v_count;

  return v_count <= p_max;
end $$;

-- THE key security decision: clients must NOT be able to call this (PostgREST would let any
-- authenticated user pass someone ELSE's key and exhaust their budget — a DoS primitive).
revoke execute on function public.consume_rate_limit(text, text, int, int) from public, anon, authenticated;
-- service_role retains execute (default PUBLIC revoked; explicit grant):
grant execute on function public.consume_rate_limit(text, text, int, int) to service_role;
```

Notes: SECURITY DEFINER + revoked-from-clients ⇒ **no new advisor WARN** (the baseline lint
flags *authenticated-executable* definer functions only). Fixed-window means a boundary burst
can briefly double a limit — acceptable at lenient settings; sliding windows aren't worth the
complexity.

## 3. Service-role client (`$lib/server/admin.ts` — NEW, first wiring of the service key)

```ts
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';   // SUPABASE_SERVICE_ROLE_KEY — server-only
import { env as pub } from '$env/dynamic/public';

/** Service-role client. SERVER ONLY ($lib/server). Bypasses RLS — use for the rate-limit RPC
 *  and nothing else without a design note. No session persistence. */
export const adminClient = createClient(pub.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false }
});
```

- Env var name matches `.env.local`: **`SUPABASE_SERVICE_ROLE_KEY`**.
- **Owner action:** add it to Vercel env (all environments), server-side only (no `PUBLIC_` prefix
  ⇒ never bundled). `$env/dynamic/private` keeps the build env-independent (same rationale as
  PR #46).

## 4. Helper (`$lib/server/rate-limit.ts`)

```ts
export const LIMITS = {
  comment:        { max: 10,  windowSecs: 300 },
  comment_delete: { max: 30,  windowSecs: 300 },
  engage:         { max: 60,  windowSecs: 300 },    // vote/unvote/interest/uninterest/follow/unfollow toggles
  pledge:         { max: 10,  windowSecs: 300 },    // pledge + withdraw
  answer:         { max: 5,   windowSecs: 3600 },   // answer submit (artifacts ride inside the same action)
  idea_create:    { max: 10,  windowSecs: 3600 },   // expert posts an idea (console)
  review:         { max: 60,  windowSecs: 300 },    // author review transitions (console RPCs)
  profile:        { max: 10,  windowSecs: 3600 },
  admin:          { max: 120, windowSecs: 300 },
  login:          { max: 10,  windowSecs: 900 },    // per-IP (anon at that point)
} as const;
export type Bucket = keyof typeof LIMITS;
```

`rateLimit(event, bucket): Promise<{ ok: boolean }>`:
- key = `user:<auth user id>` when signed in (via `safeGetSession`), else `ip:<event.getClientAddress()>`
  (on Vercel this is the trusted `x-forwarded-for`).
- Calls `adminClient.rpc('consume_rate_limit', …)` with the bucket's max/window.
- **Fails OPEN**: any RPC error ⇒ `console.error` + `{ ok: true }`. A limiter outage must never
  take the site down; the durable risk (spam) is bounded, the availability risk is not.

Action wiring (two lines per action):

```ts
if (!(await rateLimit(event, 'comment')).ok)
  return fail(429, { message: 'Slow down — try again in a moment.' });
```

The 429 surfaces through each form's existing error display; no new UI.

## 5. Bucket → action map (complete)

Verified against the actual action inventory (every `export const actions` member in the repo,
2026-06-07) — **no unthrottled mutation remains**:

| Bucket | Limit | Actions (file) |
|---|---|---|
| `comment` | 10/5min | `comment` (ideas/[id]) |
| `comment_delete` | 30/5min | `delete_comment` (ideas/[id]) |
| `engage` | 60/5min | `vote`, `unvote`, `interest`, `uninterest` (ideas/[id]); `follow`, `unfollow` (dashboard) |
| `pledge` | 10/5min | `pledge` (ideas/[id]); `withdraw` (dashboard) |
| `answer` | 5/h | `default` answer submit, artifacts included in the same action (ideas/[id]/answer) |
| `idea_create` | 10/h | `create` (console) |
| `review` | 60/5min | `start_review`, `verify`, `request_revision`, `reject` (console) |
| `profile` | 10/h | `update` (u/[handle]) |
| `admin` | 120/5min | `setStatus` (admin/experts); `approve`, `reject` (admin/payouts) |
| `login` | 10/15min per IP | `google`, `magiclink` (login) |

Exempt: `logout` `default` (harmless, idempotent). There is no expert-apply action (expert status
is admin-set via `setStatus`), so no `apply` bucket.

## 6. Testing

- **pgTAP** (`rate_limits_test.sql`): under-limit true → over-limit false within one window;
  window rollover resets; separate keys/buckets independent; cleanup removes stale rows;
  **execute denied for anon + authenticated** (the DoS hole pinned shut); table unreadable/unwritable
  by client roles (zero policies).
- **Vitest** (`rate-limit.test.ts`): keying (user vs ip), limits table lookup, fail-open on RPC
  error (mocked), fail-closed-on-false (429 path) in one representative action test.
- Manual: 11 rapid comments locally → the 11th gets the friendly 429 message.

## 7. Risks / accepted

- **Fail-open** trades abuse-resistance for availability — deliberate.
- Fixed-window boundary bursts (≤2× briefly) — accepted at lenient caps.
- The service-role key now lives in the running server's env — standard Supabase posture; it was
  always going to be wired for Phase 2 money; `$lib/server` placement keeps it out of the client
  bundle (build asserts this: importing `$env/dynamic/private` from client code is a build error).
- Per-user keys mean a shared-account attacker self-throttles only themselves — fine; IP keying
  covers anon. IPv6 rotation can dodge `ip:` buckets — accepted for Phase 1 (WAF is the Phase-2
  escalation if needed).
