# Authed End-to-End (Playwright) Test Suite (design)

**Date:** 2026-06-07 · **Status:** approved by owner (this session)
**Goal:** Cover the research-bounty loop with real authenticated journeys (the spec's §9 Playwright
target), giving pre-launch confidence that the whole loop works through the UI as four distinct
roles. Tests only - **no app / RPC / DB changes.**

## 1. The core loop under test

expert posts idea → funder pledges → submitter submits answer (+artifact) → idea author **verifies**
(with the verify→payout signature moment) → admin charitable-purpose gate **approves** → intended
payout recorded. Money is OFF (the amount is the recorded `payout_amount_cents`, label "Intended
payout").

## 2. Owner decisions (this session)

1. **Scope:** happy path + key negative paths (~6 authed tests).
2. **Animation:** assert the moment (the "Verified" seal text + the count-up amount) **and** the end
   state. The moment is success-gated and **held ~700ms** before the row refetches away; Playwright's
   web-first auto-waiting catches the seal text within that window with no manual timeout. (We do NOT
   force reduced-motion - under reduced motion the hold is skipped and the moment would vanish before
   it could be asserted. Playwright never waits on the animation itself, only polls for the text.)
3. **CI:** a new CI job runs the authed suite on every PR.

## 3. Auth & seeding strategy (no service-role key, no app changes, no OAuth)

The named challenge - authing as 4 roles against local Supabase - is solved in a Playwright
**global-setup** (`e2e/global-setup.ts`):

### 3.1 Create the role users via `auth.signUp`, set roles via SQL
Creating users with a **real, GoTrue-valid password** is done through `supabase.auth.signUp` (anon
key) - not by hand-writing a bcrypt hash into `auth.users` (which risks a format GoTrue won't accept
at `signInWithPassword`). GoTrue hashes the password itself; **no service-role key.** For each of
the 5 role emails, global-setup calls `signUp({ email, password: 'e2e-password-…' })`, catching the
"user already registered" error so reruns are idempotent.

Then `e2e/fixtures/seed.sql` runs against the local DB (`docker exec … psql -U postgres`, the same
access the pgTAP suite uses) to (a) **confirm emails** (`update auth.users set email_confirmed_at =
now() where email like 'e2e-%@example.com' and email_confirmed_at is null` - in case local
confirmations are on) and (b) **set roles**, matching by email (no fixed UUIDs needed):

| Email | Role | Role SQL |
|---|---|---|
| `e2e-expert@example.com` | approved expert (idea author) | `insert into public.experts (id, status) select id, 'approved' from auth.users where email = … on conflict (id) do nothing` |
| `e2e-expert2@example.com` | second approved expert (negative test) | same |
| `e2e-funder@example.com` | member | - |
| `e2e-submitter@example.com` | member | - |
| `e2e-admin@example.com` | admin | `update public.profiles set is_admin = true where id = (select id from auth.users where email = …)` |

The `handle_new_user` trigger auto-creates each `profiles` row on signUp. Unique-to-e2e emails +
idempotent role SQL ⇒ a developer's local data is never wiped; CI starts fresh from `supabase start`
anyway. (If local email confirmations are disabled in `config.toml`, the confirm UPDATE is simply a
no-op.)

### 3.2 Mint each role's cookies by letting `@supabase/ssr` write them
For each role, construct a `createServerClient` (from `@supabase/ssr`) with the **anon** key and an
**in-memory cookie jar** (custom `getAll`/`setAll`), then `signInWithPassword`. The library populates
the jar with the exact session cookie(s) the app reads - correct name (`sb-…-auth-token`), chunking,
and `base64-` encoding - so **nothing is hand-encoded or guessed.** Convert the jar to a Playwright
`storageState` JSON (`cookies` with `domain: 'localhost'`, `path: '/'`, the captured name/value) and
write one file per role under `e2e/.auth/<role>.json` (gitignored).

Global-setup verifies each storageState by loading `/dashboard` in a context using it and asserting
no redirect to `/login` (fail fast if the cookie format ever drifts).

### 3.3 Using the roles in tests
- Single-role specs declare `test.use({ storageState: 'e2e/.auth/<role>.json' })`.
- The **golden loop** needs to switch actors within one flow, so it opens a fresh
  `browser.newContext({ storageState })` per role (expert → funder → submitter → expert author →
  admin) and drives each through its UI step.

## 4. Journeys (~6 authed tests)

1. **Golden loop** (`e2e/loop.spec.ts`): expert posts an idea (unique title per run) via `/console`
   → funder pledges on `/ideas/[id]` (BountyMeter reflects it) → submitter submits an answer +
   artifact via `/ideas/[id]/answer` → author opens `/console`, enters an intended payout, clicks
   Verify → **assert the moment**: the row shows the "Verified" seal text and the count-up amount →
   admin opens `/admin/payouts`, approves → assert the answer is verified + the intended payout is
   recorded (visible on the idea page / admin list).
2. **Member blocked** (`e2e/guards.spec.ts`): a funder hitting `/console`, `/admin/experts`,
   `/admin/payouts` gets an **HTTP 403 error page** ("Approved experts only" / "Admins only") at the
   same URL - authed-but-unauthorized hits the page-level role gate (`error(403,…)`), NOT the
   `/login` redirect (which `hooks.server.ts` only does for *unauthenticated* users - already covered
   by the existing smoke tests).
3. **Non-author can't act** (`guards.spec.ts`): a second seeded approved expert
   (`e2e-expert2@example.com`) does **not** see the first expert's answer in their own review queue
   (the console queue is scoped to the caller's ideas).
4. **Reject path** (`loop.spec.ts` or a sibling): author rejects an answer → the row dims and the
   answer ends `rejected` (badge on the idea page).
5. **Revision path**: author requests revision → amber settle; the answer ends `revision_requested`
   and the row stays in the queue (in-place feedback, per the animation spec).
6. **Funder dashboard** (`e2e/dashboard.spec.ts`): after pledging + following the expert, the funder
   sees the pledge under "my funding" and the expert's idea in the followed-expert feed.

(The existing 11 unauthenticated smoke specs stay as-is.)

## 5. Determinism & CI

- **Normal motion (NOT reduced):** the verify→payout moment relies on its ~700ms hold to stay
  on-screen for assertion; reduced-motion skips the hold. Playwright auto-waits for the "Verified"
  seal text / counted amount during the hold window - no `waitForTimeout`, and it never blocks on the
  animation itself (it polls for the element). Other tests are navigation/state assertions, motion-agnostic.
- **Self-contained tests:** each creates its own idea/answer with a per-run-unique title
  (`Idea ${Date.now()}` style - but since Playwright forbids `Date.now()`-nondeterminism only in
  *snapshots*, a unique title via `crypto.randomUUID()` slice is fine), so reruns don't collide and
  leftover rows are harmless.
- **`test:e2e` script** (package.json): assumes the local stack is up (`supabase start`); points the
  app at local via env (`PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`,
  `PUBLIC_SUPABASE_ANON_KEY=<local anon>`); runs Playwright (its `webServer` already does
  `build && preview` on :4173). Global-setup runs the seed first.
- **CI job `e2e`** (`.github/workflows/ci.yml`): checkout → `supabase/setup-cli@v1` (pinned, like the
  `db` job) → `supabase start` → `npx playwright install --with-deps chromium` → `npm ci` →
  `npm run test:e2e` with the local env. Browser limited to Chromium for speed.

## 6. Files

| File | Responsibility |
|---|---|
| `e2e/fixtures/seed.sql` (new) | idempotent SQL: confirm emails + set roles (expert×2, admin) by email |
| `e2e/global-setup.ts` (new) | `signUp` 5 role users → run seed.sql → mint per-role `storageState` → verify each |
| `e2e/auth.ts` (new) | helpers: role constants (email/password/storageState path), the cookie-mint fn |
| `e2e/loop.spec.ts` (new) | golden loop + reject/revision |
| `e2e/guards.spec.ts` (new) | authed-but-unauthorized + non-author |
| `e2e/dashboard.spec.ts` (new) | funder dashboard reflects pledge + follow |
| `playwright.config.ts` (modify) | `globalSetup`, `use.reducedMotion`, local-env webServer |
| `package.json` (modify) | `test:e2e` script |
| `.github/workflows/ci.yml` (modify) | new `e2e` job |
| `.gitignore` (modify) | ignore `e2e/.auth/` |

## 7. Risks / accepted

- **Local env values in CI:** the local anon key + URL are the standard non-secret local-dev demo
  values - safe to put in the test env / CI job (not production secrets).
- **Cookie-format drift:** mitigated by letting `@supabase/ssr` write the cookie (not hardcoding) +
  the global-setup `/dashboard` verification that fails fast.
- **`storageState` session expiry:** local sessions are long-lived; minted fresh each run in
  global-setup, so expiry within a CI run is a non-issue.
- **No service-role key anywhere** (consistent with [[no-service-role-in-app]]): users are created
  via the anon `auth.signUp`; roles are set with plain SQL as `postgres` on the local stack (test
  infra, never shipped); cookie minting uses the **anon** key + a real password sign-in.
- **Money stays OFF:** the loop asserts the *recorded intended payout*, never a transfer.
- No app/RPC/DB/migration changes; the suite is additive over the existing smoke specs.
