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

## 2. Schema (one migration: `rate_limits`) — NO service role, pure RLS

> **Owner principle (2026-06-07): the app never uses a service-role *client* — see
> [[no-service-role-in-app]].** A `SECURITY DEFINER` *database function* is **not** that: a DB-side
> primitive owned by `postgres`, identical to the repo's 8 existing answer/payout RPCs. The
> principle targets app-code service-role clients, not definer functions.

**Why DEFINER, not INVOKER (revised after the 6-lens plan review).** An earlier draft used
SECURITY INVOKER + own-rows RLS policies. That is **fully bypassable**: own-rows UPDATE/DELETE
policies let an authenticated user reset their own counter directly via PostgREST
(`PATCH …count=0`, `DELETE …`), and a caller-supplied window param weaponizes the cleanup. The
fix matches the repo's established pattern for sensitive tables: a **SECURITY DEFINER** function
self-keyed on `auth.uid()` over a table with **zero client policies** (deny-all DML). Clients
cannot touch `rate_limits` at all; the function is the only writer; and the limits are
**looked up server-side inside the function** (no caller-passed max/window), so there is nothing
to spoof.

```sql
create table public.rate_limits (
  key          text not null,         -- 'user:<uuid>' (authed users only; anon login → §4)
  bucket       text not null,
  window_start timestamptz not null,  -- aligned to the bucket's window size
  count        int  not null default 1,
  primary key (key, bucket, window_start)
);
alter table public.rate_limits enable row level security;
-- ZERO policies: deny-by-default for every client role (matches answers/answer_reviews).
-- Only the SECURITY DEFINER function below (owner = postgres, bypasses RLS) ever touches it.
```

```sql
-- Limits are AUTHORITATIVE here (server-side), not caller params — nothing to weaponize.
create function public.consume_rate_limit(p_bucket text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_max int;
  v_window_secs int;
  v_window timestamptz;
  v_count int;
begin
  if v_uid is null then
    return true;   -- anon callers are not tracked here (login uses the in-memory limiter, §4)
  end if;

  case p_bucket
    when 'comment'        then v_max := 10;  v_window_secs := 300;
    when 'comment_delete' then v_max := 30;  v_window_secs := 300;
    when 'engage'         then v_max := 60;  v_window_secs := 300;
    when 'pledge'         then v_max := 10;  v_window_secs := 300;
    when 'answer'         then v_max := 5;   v_window_secs := 3600;
    when 'idea_create'    then v_max := 10;  v_window_secs := 3600;
    when 'review'         then v_max := 60;  v_window_secs := 300;
    when 'profile'        then v_max := 10;  v_window_secs := 3600;
    when 'admin'          then v_max := 120; v_window_secs := 300;
    else raise exception 'unknown rate-limit bucket: %', p_bucket;  -- dev bug → caught by fail-open + log
  end case;

  v_window := to_timestamp(floor(extract(epoch from now()) / v_window_secs) * v_window_secs);

  -- prune this caller's stale rows for this bucket (definer-owned; no client DELETE path exists)
  delete from public.rate_limits
    where key = 'user:' || v_uid::text and bucket = p_bucket
      and window_start < now() - make_interval(secs => 2 * v_window_secs);

  insert into public.rate_limits as r (key, bucket, window_start)
    values ('user:' || v_uid::text, p_bucket, v_window)
    on conflict (key, bucket, window_start)
    do update set count = r.count + 1
    returning count into v_count;

  return v_count <= v_max;
end $$;

revoke execute on function public.consume_rate_limit(text) from public, anon;
grant execute on function public.consume_rate_limit(text) to authenticated;
```

Notes: adds **one** `authenticated_security_definer_function_executable` advisor WARN (9 → 10),
accepted on the same grounds as the existing 8 (self-authorizes via `auth.uid()`, touches only the
caller's own rows). All three INVOKER bypass vectors are closed — no client DML (zero policies), no
caller-controlled limit/window, count never client-writable (so the INT_MAX→fail-open poison is
impossible too). Fixed-window can briefly double a limit at a boundary — accepted at lenient caps.

## 3. No service-role client

The user-scoped `locals.supabase` client calls the definer RPC; the *function* (not a client) holds
the privilege. `SUPABASE_SERVICE_ROLE_KEY` stays unwired; no Vercel env action needed.

## 4. Helper (`$lib/server/rate-limit.ts`)

The **limit values are authoritative in the SQL function** (§2) — not duplicated in TS. The module
exposes only the bucket-name union (so call sites are type-checked) and the login config:

```ts
// The DB function owns the numbers; this list must stay in sync with its CASE (a comment in each
// points at the other). The set of buckets, not their limits, is what TS needs.
export const BUCKETS = [
  'comment', 'comment_delete', 'engage', 'pledge', 'answer',
  'idea_create', 'review', 'profile', 'admin'
] as const;
export type Bucket = (typeof BUCKETS)[number];
// login (10 / 15 min per IP) is the in-memory limiter below, NOT a DB bucket.
```

Two limiters, matched to what each role can do safely:

- **Authed buckets (everything except `login`):** `rateLimit(supabase, bucket): Promise<{ ok: boolean }>`
  calls `supabase.rpc('consume_rate_limit', { p_bucket: bucket })` — the action's own
  `locals.supabase`; the RPC self-keys on `auth.uid()` and looks up the limit server-side (§2).
  All these actions already require a session, so the anon-returns-true branch is never the
  deciding check. **Fails OPEN**: any RPC error ⇒ `console.error` + `{ ok: true }`. A limiter
  outage must never take the site down; the durable risk (spam) is bounded, the availability risk
  is not. (Passing `supabase` rather than the whole `event` keeps the helper trivially unit-testable.)
- **`login` (anon — the DB cannot key anon callers without trusting spoofable input):** a small
  **in-memory fixed-window map** in the same module, keyed by `event.getClientAddress()`. **Best-effort
  only:** on Vercel that value derives from `x-forwarded-for`, which is client-*influenced*, and the
  map is per-fluid-compute-instance (real cap ≈ `10 × instances`, resets on cold start). It is
  **not** an anti-spoof control — **Supabase Auth's own server-side email limits are the real
  backstop**; this just blunts casual repeat-submits. Pruned on access with a 10k-entry memory cap.

Action wiring (two lines per authed action; login uses `loginLimited`):

```ts
if (!(await rateLimit(supabase, 'comment')).ok)
  return fail(429, { message: RATE_LIMIT_MESSAGE });
```

The 429 surfaces through each form's existing error display; no new UI. `RATE_LIMIT_MESSAGE`
("Slow down — try again in a moment.") is shared across the authed buckets; `login` uses its own
"Too many attempts — try again in a few minutes." copy.

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
  separate buckets independent; cross-user isolation (B starts fresh); **the three closed bypass
  vectors are asserted** — a direct client `SELECT`/`UPDATE count=0`/`DELETE` on `rate_limits`
  affects/returns **zero rows** (the zero-policy lockdown), so the next `consume` is NOT reset;
  unknown bucket raises; anon `execute` denied. Window rollover is tested by **aging a stored row
  as the table owner** (`now()` is frozen inside a txn, so `pg_sleep` can't drive it) then calling
  again, asserting reset + that cleanup pruned the stale row.
- **Vitest** (`rate-limit.test.ts`): `rateLimit` passes only `{ p_bucket }`, allows on true, blocks
  on false, **fails open on RPC error**; the in-memory login limiter (window expiry, per-IP
  independence, prune). One action test: over-limit `comment` → 429 with `RATE_LIMIT_MESSAGE`,
  asserting no insert ran (guard precedes the write).
- Manual: 11 rapid authed actions locally → the 11th gets the friendly 429.

## 7. Risks / accepted

- **Fail-open** trades abuse-resistance for availability — deliberate.
- Fixed-window boundary bursts (≤2× briefly) — accepted at lenient caps.
- **DEFINER, not a service-role client.** The privilege lives in a `postgres`-owned function with
  internal `auth.uid()` self-keying and zero client table access — the repo's established pattern,
  consistent with [[no-service-role-in-app]]. Adds one accepted advisor WARN (9 → 10).
- **`login` limiter is best-effort**, per-instance in-memory and IP-spoofable; Supabase Auth's own
  email limits are the real backstop. DB-keying anon would hand attackers a spoofable key, so it's
  deliberately not done.
- A signed-in attacker can throttle only themselves; anon abuse beyond login (read flooding) is out
  of scope — reads are cheap/cacheable; WAF is the Phase-2 escalation.
- **Limit values live in the SQL function** (authoritative). Tuning a limit = a one-line migration;
  rollback = revert it. The TS `BUCKETS` list must stay in sync with the function's `CASE` (paired
  comments flag this); a bucket in one but not the other is caught by `npm run check` (TS) or the
  unknown-bucket `raise` (SQL, surfaced via fail-open logging).
