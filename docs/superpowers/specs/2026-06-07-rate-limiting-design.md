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

> **Owner principle (2026-06-07): the app never uses a service-role client — RLS is the only
> authority.** The original draft used a service-role-only SECURITY DEFINER RPC; rejected.

The trick that makes client-role rate limiting safe: the function is **SECURITY INVOKER** and
derives its key from `auth.uid()` **internally** (no key parameter), so RLS pins every row to
the caller. A malicious direct call via PostgREST can only increment the attacker's *own*
counter — self-harm, never a cross-user DoS. Bypass is impossible (clients can only add counts,
never reset them; the server's verdict reads the same pinned rows).

```sql
create table public.rate_limits (
  key          text not null,         -- 'user:<uuid>' (DB tracks authed users only; anon → §4)
  bucket       text not null,         -- endpoint family, e.g. 'comment'
  window_start timestamptz not null,  -- aligned to the bucket's window size
  count        int  not null default 1,
  primary key (key, bucket, window_start)
);
alter table public.rate_limits enable row level security;

-- Own-rows-only for every verb (key is pinned to the caller — the whole security model):
create policy "own rate rows select" on public.rate_limits for select to authenticated
  using (key = 'user:' || (select auth.uid())::text);
create policy "own rate rows insert" on public.rate_limits for insert to authenticated
  with check (key = 'user:' || (select auth.uid())::text);
create policy "own rate rows update" on public.rate_limits for update to authenticated
  using (key = 'user:' || (select auth.uid())::text)
  with check (key = 'user:' || (select auth.uid())::text);
create policy "own rate rows delete" on public.rate_limits for delete to authenticated
  using (key = 'user:' || (select auth.uid())::text);
```

```sql
create function public.consume_rate_limit(p_bucket text, p_max int, p_window_secs int)
returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare
  v_key text;
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_secs) * p_window_secs);
  v_count int;
begin
  if (select auth.uid()) is null then
    return true;   -- anon callers are not tracked here (login uses the in-memory limiter, §4)
  end if;
  v_key := 'user:' || (select auth.uid())::text;

  -- opportunistic cleanup of the CALLER's stale rows (RLS-scoped; keeps per-user rows ~2/bucket)
  delete from public.rate_limits
    where key = v_key and bucket = p_bucket
      and window_start < now() - make_interval(secs => 2 * p_window_secs);

  insert into public.rate_limits as r (key, bucket, window_start)
    values (v_key, p_bucket, v_window)
    on conflict (key, bucket, window_start)
    do update set count = r.count + 1
    returning count into v_count;

  return v_count <= p_max;
end $$;

revoke execute on function public.consume_rate_limit(text, text, int) from public, anon;
grant execute on function public.consume_rate_limit(text, text, int) to authenticated;
```

Notes: SECURITY INVOKER ⇒ **no new advisor WARN** and no RLS bypass anywhere. `p_max`/
`p_window_secs` come from the server's constants; a direct caller passing garbage values only
pollutes their own key (and cannot lower the count the server sees). Fixed-window means a
boundary burst can briefly double a limit — acceptable at lenient settings.

## 3. No service-role client

Deliberately none. The user-scoped `locals.supabase` client calls the RPC; RLS does all
enforcement. (The `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` stays unwired; no Vercel env
action needed.)

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
  admin:          { max: 120, windowSecs: 300 }
} as const;
export type Bucket = keyof typeof LIMITS;
// login (10 / 15 min per IP) lives OUTSIDE LIMITS — it's the in-memory limiter below, not the DB RPC
```

Two limiters, matched to what each role can do safely:

- **Authed buckets (everything except `login`):** `rateLimit(event, bucket): Promise<{ ok: boolean }>`
  calls `event.locals.supabase.rpc('consume_rate_limit', { p_bucket, p_max, p_window_secs })` —
  the user's own client; the RPC self-keys on `auth.uid()` (§2). All these actions already
  require a session, so the anon-returns-true branch is never the deciding check.
  **Fails OPEN**: any RPC error ⇒ `console.error` + `{ ok: true }`. A limiter outage must never
  take the site down; the durable risk (spam) is bounded, the availability risk is not.
- **`login` bucket (anon — the DB cannot key anon callers without trusting spoofable input):**
  a small **in-memory fixed-window map** in the same module, keyed by
  `event.getClientAddress()` (trusted `x-forwarded-for` on Vercel), pruned on access.
  Per-fluid-compute-instance, so the real cap is `10 × instances` and resets on cold start —
  explicitly **belt-and-suspenders**; Supabase Auth's own server-side email limits are the real
  backstop. No DB, no spoofable key, nothing an attacker can exhaust for someone else
  (worst case: shared-IP neighbors share a generous bucket).

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
  window rollover resets; separate buckets independent; **one user's consumption cannot touch
  another user's rows** (call as A, then as B — B starts fresh; A cannot select/update/delete
  B's rows directly); anon `execute` denied; cleanup removes the caller's stale rows only.
- **Vitest** (`rate-limit.test.ts`): bucket→params lookup, fail-open on RPC error (mocked),
  fail-closed-on-false (429 path) in one representative action test; the in-memory login
  limiter (window expiry, per-IP independence, prune).
- Manual: 11 rapid comments locally → the 11th gets the friendly 429 message.

## 7. Risks / accepted

- **Fail-open** trades abuse-resistance for availability — deliberate.
- Fixed-window boundary bursts (≤2× briefly) — accepted at lenient caps.
- **No service role anywhere** (owner principle). Consequence: the `login` limiter is per-instance
  in-memory and therefore leaky — accepted, because Supabase Auth's own email limits backstop it
  and the alternative (DB-keyed anon) would hand attackers a spoofable key.
- A signed-in attacker can self-throttle only themselves; anon abuse beyond login (e.g. read
  flooding) is out of scope — reads are cheap and cacheable; WAF is the Phase-2 escalation.
- Direct RPC calls with garbage `p_max`/`p_window_secs` pollute only the caller's own rows and
  can never lower the count the server's check sees.
