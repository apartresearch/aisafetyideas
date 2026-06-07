# App-wide Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development for Tasks 1–3. Steps use checkbox (`- [ ]`) syntax. **Task 4 is CONTROLLER-ONLY** (cloud). Subagents must never touch the cloud project or edit `CLAUDE.md`/`docs/`/`.claude/`/`src_legacy_v0/`, and never `git add .`/`git add -A` at repo root (untracked `.claude/` must stay uncommitted).

**Goal:** Per-endpoint rate limiting on every mutation (20 form actions across 9 routes) with **zero service-role usage** — a SECURITY INVOKER RPC self-keyed on `auth.uid()` over an RLS-pinned table, plus a per-instance in-memory limiter for the anon login actions.

**Architecture:** One migration (`rate_limits` table with own-rows-only RLS + `consume_rate_limit` invoker function, executable by `authenticated` only) + one server module `$lib/server/rate-limit.ts` (`LIMITS` constants, DB-backed `rateLimit(supabase, bucket)` that FAILS OPEN, in-memory `loginLimited(ip)`) + a two-line guard in each action. Spec: `docs/superpowers/specs/2026-06-07-rate-limiting-design.md`.

**Tech Stack:** Postgres 17 / pgTAP, SvelteKit 2 form actions, supabase-js v2 (typed client — types regen required), vitest.

**Security model (read first):** the RPC derives its key internally from `auth.uid()` — there is NO key parameter. A malicious direct PostgREST call can only increment the caller's own counter (self-harm); cross-user DoS is impossible and counts can never be lowered. Anon callers cannot be keyed safely through the DB (spoofable), so `login` uses the in-memory limiter. **No service-role client anywhere** (owner principle — do not introduce one).

---

## File structure

| File | Responsibility |
|---|---|
| `supabase/migrations/<ts>_rate_limits.sql` | table + 4 own-rows policies + invoker RPC + grants |
| `supabase/tests/database/rate_limits_test.sql` | pgTAP: limit math, isolation, rollover, cleanup, anon denied |
| `src/lib/types/database.ts` | regenerated (RPC + table types) |
| `src/lib/server/rate-limit.ts` | `LIMITS`, `Bucket`, `rateLimit()` (fail-open), `loginLimited()` |
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
-- ============ rate_limits (fixed-window counters; NO service role — pure RLS) ============
-- The RPC below is SECURITY INVOKER and derives its key from auth.uid() internally, so RLS pins
-- every row to the caller: a direct PostgREST call can only increment the caller's OWN counter
-- (self-harm), never another user's, and can never lower a count the server checks.
create table public.rate_limits (
  key          text not null,         -- 'user:<uuid>' (authed users only; anon login is in-memory app-side)
  bucket       text not null,         -- endpoint family, e.g. 'comment'
  window_start timestamptz not null,  -- aligned to the bucket's window size
  count        int  not null default 1,
  primary key (key, bucket, window_start)
);
alter table public.rate_limits enable row level security;

-- Own-rows-only for every verb (key pinned to the caller — the whole security model):
create policy "own rate rows select" on public.rate_limits for select to authenticated
  using (key = 'user:' || (select auth.uid())::text);
create policy "own rate rows insert" on public.rate_limits for insert to authenticated
  with check (key = 'user:' || (select auth.uid())::text);
create policy "own rate rows update" on public.rate_limits for update to authenticated
  using (key = 'user:' || (select auth.uid())::text)
  with check (key = 'user:' || (select auth.uid())::text);
create policy "own rate rows delete" on public.rate_limits for delete to authenticated
  using (key = 'user:' || (select auth.uid())::text);

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
    return true;   -- anon callers are not tracked here (login uses the app's in-memory limiter)
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

-- ===== limit math (max=3, 1h window) =====
select ok(public.consume_rate_limit('t_bucket', 3, 3600), '1: first call under limit');
select ok(public.consume_rate_limit('t_bucket', 3, 3600), '2: second call under limit');
select ok(public.consume_rate_limit('t_bucket', 3, 3600), '3: third call AT limit still true');
select ok(not public.consume_rate_limit('t_bucket', 3, 3600), '4: fourth call over limit → false');

-- ===== per-user isolation =====
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select ok(public.consume_rate_limit('t_bucket', 3, 3600), '5: another user starts fresh in the same bucket');
select ok((select count(*) from public.rate_limits where key like 'user:1111%') = 0,
  '6: RLS hides (and protects) other users'' rows');
update public.rate_limits set count = 0 where key like 'user:1111%';
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select ok(not public.consume_rate_limit('t_bucket', 3, 3600),
  '7: bob''s update attempt touched nothing — alice is still over her limit');

-- ===== window rollover + caller-scoped cleanup (1s window so the test can outlive it) =====
-- (separate statements — never chain two volatile consume calls with AND; evaluation order is unspecified)
select ok(public.consume_rate_limit('t_roll', 1, 1), '8: first call in the 1s window allowed');
select ok(not public.consume_rate_limit('t_roll', 1, 1), '9: second call within the window over limit');
select pg_sleep(2.1);
select ok(public.consume_rate_limit('t_roll', 1, 1), '10: limit resets after the window passes');
select ok((select count(*) from public.rate_limits
           where key = 'user:11111111-1111-1111-1111-111111111111' and bucket = 't_roll') = 1,
  '11: stale t_roll rows were cleaned up (only the live window row remains)');

select * from finish();
rollback;
```

> Why no anon-execute test: `set local role anon` + claims-reset then `throws_ok('42501')` would be
> nice, but inside the same transaction the earlier `set local role authenticated` interactions make
> the matrix fiddly; the REVOKE is structural in the migration and `npm run check` + a manual PostgREST
> probe in Task 4 confirm it. If you can add it cleanly as a 12th test (reset claims to `''`,
> `set local role anon`, `throws_ok($$select public.consume_rate_limit('x',1,1)$$, '42501', null, …)`),
> do — bump `plan()` accordingly.

- [ ] **Step 3: Run** `supabase db reset` then `supabase test db` → `rate_limits_test` green (9 or 10), all existing suites still green (111 + new).
- [ ] **Step 4: Regenerate types** `supabase gen types typescript --local > src/lib/types/database.ts`; `npm run check` → 0 errors. Verify the regen contains `consume_rate_limit` and `rate_limits` (and no pgTAP pollution — regen runs after a fresh `db reset`, BEFORE `supabase test db` if pollution appears).
- [ ] **Step 5: Commit** `git add supabase/migrations supabase/tests/database/rate_limits_test.sql src/lib/types/database.ts && git commit -m "feat(rate-limit): rate_limits table + RLS-pinned invoker RPC + pgTAP + types"`

---

## Task 2: `$lib/server/rate-limit.ts` + vitest

**Files:**
- Create: `src/lib/server/rate-limit.ts`
- Create: `src/lib/server/rate-limit.test.ts`

- [ ] **Step 1: Write the failing test** `src/lib/server/rate-limit.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { LIMITS, rateLimit, loginLimited, __resetLoginLimiter } from './rate-limit';

const mkSupabase = (rpc: (...a: any[]) => any) => ({ rpc }) as any;

describe('rateLimit (DB-backed, fail-open)', () => {
  it('passes the bucket constants to the RPC and allows on true', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const res = await rateLimit(mkSupabase(rpc), 'comment');
    expect(rpc).toHaveBeenCalledWith('consume_rate_limit', {
      p_bucket: 'comment', p_max: LIMITS.comment.max, p_window_secs: LIMITS.comment.windowSecs
    });
    expect(res.ok).toBe(true);
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

/** Lenient launch caps (spec §4 — only a script should hit these; tighten from data later). */
export const LIMITS = {
  comment:        { max: 10,  windowSecs: 300 },
  comment_delete: { max: 30,  windowSecs: 300 },
  engage:         { max: 60,  windowSecs: 300 },    // vote/unvote/interest/uninterest/follow/unfollow
  pledge:         { max: 10,  windowSecs: 300 },    // pledge + withdraw
  answer:         { max: 5,   windowSecs: 3600 },
  idea_create:    { max: 10,  windowSecs: 3600 },
  review:         { max: 60,  windowSecs: 300 },
  profile:        { max: 10,  windowSecs: 3600 },
  admin:          { max: 120, windowSecs: 300 }
} as const;
export type Bucket = keyof typeof LIMITS;

/** One user-visible message everywhere (keep copy identical across actions). */
export const RATE_LIMIT_MESSAGE = 'Slow down — try again in a moment.';

/**
 * DB-backed limiter for AUTHED mutations. Calls the SECURITY INVOKER RPC with the caller's own
 * client — the RPC self-keys on auth.uid() and RLS pins the rows, so no service role is needed
 * (and none may be introduced — owner principle). FAILS OPEN on RPC error: a limiter outage must
 * never take the site down; the spam risk is bounded, the availability risk is not.
 */
export async function rateLimit(
  supabase: SupabaseClient<any>,
  bucket: Bucket
): Promise<{ ok: boolean }> {
  const { max, windowSecs } = LIMITS[bucket];
  const { data, error } = await supabase.rpc('consume_rate_limit', {
    p_bucket: bucket, p_max: max, p_window_secs: windowSecs
  });
  if (error) {
    console.error(`rate-limit rpc failed (fail-open) bucket=${bucket}: ${error.message}`);
    return { ok: true };
  }
  return { ok: data !== false };
}

// ── login limiter: in-memory, per-IP. The DB cannot key anon callers without trusting spoofable
// input, so this is deliberately per-fluid-compute-instance (real cap = 10 × instances, resets on
// cold start) — belt-and-suspenders; Supabase Auth's own email limits are the real backstop. ──
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
- [ ] **Step 5: Commit** `git add src/lib/server/rate-limit.ts src/lib/server/rate-limit.test.ts && git commit -m "feat(rate-limit): LIMITS + fail-open rateLimit helper + in-memory login limiter"`

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
`requireExpert` line; for admin actions, after `requireAdmin`.

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
- [ ] **Step 5: Manual smoke** (stack running, `npm run dev`): sign in locally is impractical headlessly — instead temporarily verify via the test above plus: `curl -X POST localhost:5173/login?/magiclink -d 'email=x@y.z'` 11 times → the 11th response body contains `Too many attempts` (anon path needs no session). Stop after verifying; no code changes.
- [ ] **Step 6: Commit** `git add src/routes && git commit -m "feat(rate-limit): guard all 20 mutation actions per the spec bucket map"`

---

## Task 4 (CONTROLLER ONLY — cloud): migrate + PR

- [ ] Apply the `rate_limits` migration to `gjomchhbsbtauzkpyjwa`: MCP `apply_migration` if the MCP has been re-authed, else the Management API query endpoint (PAT) with the DDL + a `supabase_migrations.schema_migrations` history row (version = the migration timestamp, name `rate_limits`) — the proven v2 path.
- [ ] Cloud probe: as an authenticated PostgREST call, `consume_rate_limit` works and self-keys; as anon it is denied (verify the revoke). Check `rate_limits` is not readable cross-user.
- [ ] Re-run security advisors (Management API `/advisors/security`) — expect the unchanged baseline (the new function is SECURITY INVOKER ⇒ no new WARN).
- [ ] Push branch, `gh pr create` (summary: no-service-role rate limiting, bucket map, fail-open), owner merges; deployed smoke: 11 rapid magic-link attempts → 429.
- [ ] Update project memory (rate limiting done — Phase-1 security complete).

---

## Done-when
- pgTAP `rate_limits_test` green (9–10 tests) + all suites; vitest green incl. helper + wiring tests; `npm run check` 0 errors; build clean.
- Every action in the §5 map guarded; `logout` exempt; login per-IP in-memory.
- No service-role client anywhere in `src/` (grep `SERVICE_ROLE` → only `.env.local`).
- Cloud migrated, advisors at baseline, PR merged.
