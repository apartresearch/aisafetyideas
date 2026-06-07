# App-wide Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development for Tasks 1–3. Steps use checkbox (`- [ ]`) syntax. **Task 4 is CONTROLLER-ONLY** (cloud). Subagents must never touch the cloud project or edit `CLAUDE.md`/`docs/`/`.claude/`/`src_legacy_v0/`, and never `git add .`/`git add -A` at repo root (untracked `.claude/` must stay uncommitted).

**Goal:** Per-endpoint rate limiting on every mutation (20 form actions across 9 routes) with **no service-role client** — a SECURITY DEFINER RPC self-keyed on `auth.uid()` (limits authoritative in the function) over a zero-policy table, plus a per-instance in-memory limiter for the anon login actions.

**Architecture:** One migration (`rate_limits` table with **zero client policies** + `consume_rate_limit` SECURITY DEFINER function that self-keys on `auth.uid()` and owns the limit values, executable by `authenticated` only) + one server module `$lib/server/rate-limit.ts` (`BUCKETS` name list, DB-backed `rateLimit(supabase, bucket)` that FAILS OPEN, in-memory `loginLimited(ip)`) + a two-line guard in each action. The DEFINER function is a DB primitive, **not** a service-role client ([[no-service-role-in-app]]). Spec: `docs/superpowers/specs/2026-06-07-rate-limiting-design.md`.

**Tech Stack:** Postgres 17 / pgTAP, SvelteKit 2 form actions, supabase-js v2 (typed client — types regen required), vitest.

**Security model (read first):** the RPC derives its key internally from `auth.uid()` — there is NO key parameter. A malicious direct PostgREST call can only increment the caller's own counter (self-harm); cross-user DoS is impossible and counts can never be lowered. Anon callers cannot be keyed safely through the DB (spoofable), so `login` uses the in-memory limiter. **No service-role client anywhere** (owner principle — do not introduce one).

---

## File structure

| File | Responsibility |
|---|---|
| `supabase/migrations/<ts>_rate_limits.sql` | table + 4 own-rows policies + invoker RPC + grants |
| `supabase/tests/database/rate_limits_test.sql` | pgTAP: limit math, isolation, rollover, cleanup, anon denied |
| `src/lib/types/database.ts` | regenerated (RPC + table types) |
| `src/lib/server/rate-limit.ts` | `BUCKETS`, `Bucket`, `RATE_LIMIT_MESSAGE`, `rateLimit()` (fail-open), `loginLimited()` |
| `src/lib/server/rate-limit.test.ts` | vitest for both limiters |
| 9 `+page.server.ts` route files | two-line guard per action (bucket map below) |

---

## Task 1: `rate_limits` migration + pgTAP + types

**Files:**
- Create: `supabase/migrations/<generated>_rate_limits.sql` (via `supabase migration new rate_limits`)
- Create: `supabase/tests/database/rate_limits_test.sql`
- Modify: `src/lib/types/database.ts` (regenerated)

- [ ] **Step 1: Create the migration** (`supabase migration new rate_limits`, then fill with exactly):

```sql
-- ============ rate_limits (fixed-window counters; NO service-role CLIENT) ============
-- Writes go ONLY through the SECURITY DEFINER function below (owned by postgres, bypasses RLS),
-- which self-keys on auth.uid() and looks up limits server-side. The table has ZERO client
-- policies, so a direct PostgREST UPDATE/DELETE/SELECT by `authenticated` matches nothing — the
-- three INVOKER bypass vectors (self-reset count, self-delete, caller-chosen window) are closed.
-- A definer function is a DB primitive, NOT the forbidden service-role client (see memory).
create table public.rate_limits (
  key          text not null,         -- 'user:<uuid>' (authed users only; anon login is in-memory app-side)
  bucket       text not null,
  window_start timestamptz not null,  -- aligned to the bucket's window size
  count        int  not null default 1,
  primary key (key, bucket, window_start)
);
alter table public.rate_limits enable row level security;
-- ZERO policies on purpose (deny-by-default for every client role, like answers/answer_reviews).

-- Limits are AUTHORITATIVE here (server-side), not caller params — nothing for a client to spoof.
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
    return true;   -- anon callers are not tracked here (login uses the app's in-memory limiter)
  end if;

  -- authoritative limit table; keep in sync with BUCKETS in $lib/server/rate-limit.ts
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
    else raise exception 'unknown rate-limit bucket: %', p_bucket;  -- dev bug → fail-open + logged
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

- [ ] **Step 2: Write the pgTAP test** `supabase/tests/database/rate_limits_test.sql` (conventions per `idea_votes_test.sql`; `handle_new_user` auto-creates profiles):

```sql
begin;
select plan(11);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','alice@example.com','x', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','bob@example.com','x', now(), now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- ===== limit math on 'answer' (max 5 / hour); 4 warm-up calls, then assert at/over limit =====
select public.consume_rate_limit('answer');
select public.consume_rate_limit('answer');
select public.consume_rate_limit('answer');
select public.consume_rate_limit('answer');
select ok(public.consume_rate_limit('answer'), '1: 5th call AT limit still true');       -- count 5 <= 5
select ok(not public.consume_rate_limit('answer'), '2: 6th call over limit → false');     -- count 6 > 5

-- ===== limits are server-authoritative: an unknown bucket raises (a dev bug, not a runtime path) =====
select throws_ok($$ select public.consume_rate_limit('nope') $$, 'P0001', null, '3: unknown bucket raises');

-- ===== zero-policy lockdown: a client cannot read or mutate rate_limits directly =====
select ok((select count(*) from public.rate_limits) = 0,
  '4: authenticated cannot SELECT rate_limits (zero policies) though rows exist via the definer fn');
with u as (update public.rate_limits set count = 0 where bucket = 'answer' returning 1)
  select ok((select count(*) from u) = 0, '5: direct UPDATE count=0 matches no rows (Vector 1 closed)');
with d as (delete from public.rate_limits where bucket = 'answer' returning 1)
  select ok((select count(*) from d) = 0, '6: direct DELETE matches no rows (Vector 2 closed)');
select ok(not public.consume_rate_limit('answer'),
  '7: still over limit — the direct UPDATE/DELETE attempts reset nothing');

-- ===== cross-user isolation: bob starts fresh in the same bucket =====
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select ok(public.consume_rate_limit('answer'), '8: another user starts fresh');

-- ===== window rollover: now() is FROZEN inside a txn, so age the stored row as the owner =====
reset role;   -- back to postgres (table owner; bypasses RLS to simulate time passing)
update public.rate_limits set window_start = window_start - interval '3 hours'
  where key = 'user:11111111-1111-1111-1111-111111111111' and bucket = 'answer';
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select ok(public.consume_rate_limit('answer'), '9: a new window resets the limit (aged row is stale)');
reset role;   -- read the table as owner to verify cleanup (clients can''t SELECT it)
select ok((select count(*) from public.rate_limits
           where key = 'user:11111111-1111-1111-1111-111111111111' and bucket = 'answer') = 1,
  '10: the stale aged row was pruned — only the live window row remains');

-- ===== anon cannot execute the function (revoked) =====
set local role anon;
set local request.jwt.claims = '';
select throws_ok($$ select public.consume_rate_limit('comment') $$, '42501', null,
  '11: anon execute is denied');

select * from finish();
rollback;
```

- [ ] **Step 3: Run** `supabase db reset` then `supabase test db` → `rate_limits_test` **11/11**, all existing suites still green (111 + 11 = 122).
- [ ] **Step 4: Regenerate types** `supabase gen types typescript --local > src/lib/types/database.ts`; `npm run check` → 0 errors. Verify the regen contains `consume_rate_limit` (now a single `p_bucket text` arg) and `rate_limits` (regen runs right after `db reset`, before `supabase test db`, so no pgTAP pollution leaks in).
- [ ] **Step 5: Commit** `git add supabase/migrations supabase/tests/database/rate_limits_test.sql src/lib/types/database.ts && git commit -m "feat(rate-limit): rate_limits table + RLS-pinned invoker RPC + pgTAP + types"`

---

## Task 2: `$lib/server/rate-limit.ts` + vitest

**Files:**
- Create: `src/lib/server/rate-limit.ts`
- Create: `src/lib/server/rate-limit.test.ts`

- [ ] **Step 1: Write the failing test** `src/lib/server/rate-limit.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { BUCKETS, rateLimit, loginLimited, __resetLoginLimiter } from './rate-limit';

const mkSupabase = (rpc: (...a: any[]) => any) => ({ rpc }) as any;

describe('rateLimit (DB-backed, fail-open)', () => {
  it('passes ONLY the bucket name to the RPC (limits are server-authoritative) and allows on true', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const res = await rateLimit(mkSupabase(rpc), 'comment');
    expect(rpc).toHaveBeenCalledWith('consume_rate_limit', { p_bucket: 'comment' });
    expect(res.ok).toBe(true);
  });
  it('exports the full bucket set for the wiring map', () => {
    expect(BUCKETS).toContain('comment');
    expect(BUCKETS).toContain('admin');
    expect(BUCKETS).not.toContain('login');   // login is the in-memory limiter, not a DB bucket
  });
  it('blocks when the RPC returns false', async () => {
    const res = await rateLimit(mkSupabase(vi.fn().mockResolvedValue({ data: false, error: null })), 'pledge');
    expect(res.ok).toBe(false);
  });
  it('FAILS OPEN when the RPC errors (limiter outage must never block users)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await rateLimit(
      mkSupabase(vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })), 'engage');
    expect(res.ok).toBe(true);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('loginLimited (in-memory, per-IP)', () => {
  it('allows up to 10 in the window, blocks the 11th, keyed per IP', () => {
    __resetLoginLimiter();
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) expect(loginLimited('1.2.3.4', t0 + i)).toBe(false);
    expect(loginLimited('1.2.3.4', t0 + 10)).toBe(true);     // 11th blocked
    expect(loginLimited('5.6.7.8', t0 + 10)).toBe(false);    // other IP unaffected
  });
  it('forgets attempts after the 15-minute window', () => {
    __resetLoginLimiter();
    const t0 = 1_000_000;
    for (let i = 0; i < 11; i++) loginLimited('1.2.3.4', t0 + i);
    expect(loginLimited('1.2.3.4', t0 + 15 * 60_000 + 100)).toBe(false);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/server/rate-limit.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** `src/lib/server/rate-limit.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Bucket NAMES only. The limit VALUES are authoritative in the SQL function
 * `public.consume_rate_limit` (its CASE) — keep this list in sync with that CASE; a bucket here
 * but not there raises at runtime (caught by fail-open + log), and vice-versa is a dead name.
 * `login` is intentionally absent — it's the in-memory limiter below, not a DB bucket.
 */
export const BUCKETS = [
  'comment', 'comment_delete', 'engage', 'pledge', 'answer',
  'idea_create', 'review', 'profile', 'admin'
] as const;
export type Bucket = (typeof BUCKETS)[number];

/** Shared 429 copy for the authed buckets (login uses its own message). */
export const RATE_LIMIT_MESSAGE = 'Slow down — try again in a moment.';

/**
 * DB-backed limiter for AUTHED mutations. Calls the SECURITY DEFINER RPC with the caller's own
 * `locals.supabase` client; the function (owned by postgres) self-keys on auth.uid() and looks
 * up the limit server-side — no service-role CLIENT involved (see memory: no-service-role-in-app).
 * FAILS OPEN on RPC error: a limiter outage must never take the site down; the spam risk is
 * bounded, the availability risk is not.
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
    // memory backstop: drop IPs with no live hits
    for (const [k, v] of loginHits) if (!v.some((t) => t > cutoff)) loginHits.delete(k);
  }
  return hits.length > LOGIN.max;
}

/** Test hook only. */
export function __resetLoginLimiter() {
  loginHits = new Map();
}
```

> If the regenerated `Database` types make `supabase.rpc('consume_rate_limit', …)` fully typed,
> prefer `SupabaseClient<Database>` (import from `$lib/types/database`) over `SupabaseClient<any>`
> — use whichever satisfies `locals.supabase`'s type without casts at the call sites.

- [ ] **Step 4: Run** `npx vitest run src/lib/server/rate-limit.test.ts` → PASS; `npm run check` → 0 errors.
- [ ] **Step 5: Commit** `git add src/lib/server/rate-limit.ts src/lib/server/rate-limit.test.ts && git commit -m "feat(rate-limit): BUCKETS + fail-open rateLimit helper + in-memory login limiter"`

---

## Task 3: wire every action

**Files (modify):**
- `src/routes/ideas/[id]/+page.server.ts` (7 actions)
- `src/routes/ideas/[id]/answer/+page.server.ts` (1)
- `src/routes/console/+page.server.ts` (5)
- `src/routes/dashboard/+page.server.ts` (3)
- `src/routes/u/[handle]/+page.server.ts` (1)
- `src/routes/admin/experts/+page.server.ts` (1)
- `src/routes/admin/payouts/+page.server.ts` (2)
- `src/routes/login/+page.server.ts` (2)
- Test: `src/routes/ideas/[id]/rate-limit-wiring.test.ts` (new)

The guard is identical everywhere; it goes **immediately after the auth/role check** (so
unauthenticated requests never consume budget) and **before any `formData()` parsing or DB write**:

```ts
import { rateLimit, RATE_LIMIT_MESSAGE } from '$lib/server/rate-limit';
// …inside the action, right after the `if (!user) return fail(401, …)` (or requireExpert/requireAdmin) check:
if (!(await rateLimit(supabase, 'comment')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
```

- [ ] **Step 1: Bucket map — apply to every action** (file → action → bucket):

| File | Action | Bucket |
|---|---|---|
| ideas/[id] | `comment` | `comment` |
| ideas/[id] | `delete_comment` | `comment_delete` |
| ideas/[id] | `vote`, `unvote`, `interest`, `uninterest` | `engage` |
| ideas/[id] | `pledge` | `pledge` |
| ideas/[id]/answer | `default` | `answer` |
| console | `create` | `idea_create` |
| console | `start_review`, `verify`, `request_revision`, `reject` | `review` |
| dashboard | `follow`, `unfollow` | `engage` |
| dashboard | `withdraw` | `pledge` |
| u/[handle] | `update` | `profile` |
| admin/experts | `setStatus` | `admin` |
| admin/payouts | `approve`, `reject` | `admin` |

`logout` stays untouched (exempt). NOTE for ideas/[id] `vote`: the guard goes after the
`if (!user)` check and before the value validation; for console actions, after the
`requireExpert` line; for admin actions, after `requireAdmin`. Actions that end in `redirect(303,…)`
on success (`console.create`) are unaffected — the guard `return fail(429,…)`s *before* the redirect
throw, so there's no interaction.

**Intentionally NOT guarded** (confirm, don't add): the `/auth/callback` GET route exchanges the
OAuth/magic-link code for a session — it's the Supabase-driven auth return, not a user-triggerable
mutation, and the `login` limiter already throttles the step that *issues* those codes. No `+server.ts`
endpoints exist. (Grep `src/routes` for `+server` / `actions` to confirm before finishing.)

- [ ] **Step 2: Login actions** (`src/routes/login/+page.server.ts`) — per-IP, in-memory; the
  actions gain `getClientAddress` in their destructure:

```ts
import { loginLimited } from '$lib/server/rate-limit';

  google: async ({ url, getClientAddress, locals: { supabase } }) => {
    if (loginLimited(getClientAddress()))
      return fail(429, { message: 'Too many attempts — try again in a few minutes.' });
    // …existing body unchanged
  },
  magiclink: async ({ request, url, getClientAddress, locals: { supabase } }) => {
    if (loginLimited(getClientAddress()))
      return fail(429, { message: 'Too many attempts — try again in a few minutes.' });
    // …existing body unchanged
  }
```

- [ ] **Step 3: Write the wiring test** `src/routes/ideas/[id]/rate-limit-wiring.test.ts` —
  representative proof that an over-limit comment returns the 429 fail (mock the supabase client;
  the `comment` action consults the RPC before inserting):

```ts
import { describe, it, expect, vi } from 'vitest';
import { actions } from './+page.server';
import { RATE_LIMIT_MESSAGE } from '$lib/server/rate-limit';

function mkEvent(rpcData: boolean) {
  const supabase: any = {
    rpc: vi.fn().mockResolvedValue({ data: rpcData, error: null }),
    from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) }))
  };
  return {
    params: { id: 'idea-1' },
    request: { formData: async () => new Map([['body_md', 'hello']]) },
    locals: {
      supabase,
      safeGetSession: async () => ({ user: { id: 'user-1' } })
    }
  } as any;
}

describe('comment action rate limiting', () => {
  it('returns 429 with the shared message when over limit, before any insert', async () => {
    const event = mkEvent(false);
    const res: any = await (actions as any).comment(event);
    expect(res?.status).toBe(429);
    expect(res?.data?.message).toBe(RATE_LIMIT_MESSAGE);
    expect(event.locals.supabase.from).not.toHaveBeenCalled();   // guard runs before the write
  });
  it('proceeds to the insert when under limit', async () => {
    const event = mkEvent(true);
    await (actions as any).comment(event);
    expect(event.locals.supabase.from).toHaveBeenCalledWith('comments');
  });
});
```

> The `request.formData` mock returns a `Map` (has `.get`) — if the action's parsing needs a real
> `FormData`, construct one instead. Adjust the mock to the action's actual shape; the assertions
> (429 + message + no insert) are the contract, not the mock.

- [ ] **Step 4: Run everything.** `npx vitest run` → all green (existing 67 + new); `npm run check` → 0 errors; `npm run build` → succeeds; `supabase test db` → all green (the wiring changes no SQL, but run it to be sure nothing drifted).
- [ ] **Step 5: Manual smoke** (stack running, `npm run dev`): the anon login limiter needs no session — `for i in $(seq 1 11); do curl -s -X POST 'localhost:5173/login?/magiclink' -F 'email=x@y.z' -o /dev/null -w "%{http_code} "; done` → the 11th is the limited response (the magic-link send to a junk address against the LOCAL stack is fine; do NOT do this against prod). Stop after verifying; no code changes.
- [ ] **Step 6: Commit** `git add src/routes && git commit -m "feat(rate-limit): guard all 20 mutation actions per the spec bucket map"`

---

## Task 4 (CONTROLLER ONLY — cloud): migrate + PR

- [ ] Apply the `rate_limits` migration to `gjomchhbsbtauzkpyjwa`. **Prefer MCP `apply_migration`** (writes the history row itself) if the MCP has been re-authed. Else the Management API query endpoint (PAT): send the migration DDL **and** the history insert in ONE query so they commit atomically — `insert into supabase_migrations.schema_migrations(version, name, statements) values('<migration timestamp>', 'rate_limits', null)` (version is the PK that gates re-apply; name/statements are nullable). (This is the v2 fallback path; it is a Management-API insert, not MCP.)
- [ ] Cloud probe (Management API, authenticated context not available — use SQL as postgres): confirm `select public.consume_rate_limit('comment')` works; `\df+` shows the grant is `authenticated` only; a direct `select/update/delete on public.rate_limits` as `authenticated`/`anon` returns/affects nothing (zero policies). Anon `execute` is revoked.
- [ ] Re-run security advisors (Management API `/advisors/security`) — expect baseline **+1**: a new `authenticated_security_definer_function_executable` WARN for `consume_rate_limit` (accepted; self-authorizes via auth.uid(), touches only the caller's rows). No other new findings.
- [ ] Push branch, `gh pr create` (summary: rate limiting via DEFINER self-keyed RPC + zero-policy table, bucket map, fail-open, in-memory login), owner merges.
- [ ] **Deployed smoke (no email burn):** sign in, then POST one guarded authed action (e.g. a comment) 11× rapidly → the 11th returns the 429 message. (Do NOT blast magic-link emails at prod — that burns Supabase Auth's email quota against a real address.)
- [ ] Update project memory (rate limiting done — Phase-1 security complete).

---

## Done-when
- pgTAP `rate_limits_test` 11/11 + all suites (122 total); vitest green incl. helper + wiring tests; `npm run check` 0 errors; build clean.
- Every action in the §5 map guarded; `logout` exempt; login per-IP in-memory; the three INVOKER bypass vectors are asserted-closed in pgTAP.
- No service-role **client** anywhere in `src/` (grep `SERVICE_ROLE` → only `.env.local`); privilege lives only in the DEFINER function.
- Cloud migrated, advisors at baseline +1 (the accepted new definer WARN), PR merged.
