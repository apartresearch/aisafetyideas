# Self-Sustaining Bounty Platform - ExecPlan

> **Corresponds to:** `docs/superpowers/specs/2026-06-08-self-sustaining-bounty-platform.md`
> (the human-readable source of truth). Section refs below (e.g. *plan §4.1*) point there.
> **For agentic workers:** execute with superpowers:subagent-driven-development. Each phase is
> independently testable; phases are ordered by dependency. **No real money until Gate 0
> (counsel) clears** - all of Phases 1–7 are built and shipped in **Stripe test mode** behind a
> `funding_enabled=false` flag.

**Tech:** SvelteKit 2 + Svelte 5, Supabase (RLS + `SECURITY DEFINER` RPCs + pgTAP), Stripe
(`stripe` Node SDK; Checkout + Connect Express + webhooks), Resend (email), the Lab AI seam
(`src/lib/server/ai.ts`), vitest + Playwright. **No service-role client anywhere.**

**Reuse (do not duplicate):** `idea_funding` + `bounty_pot`, `answers` + answer RPCs +
`answer_reviews`, `experts` + `is_admin()`, `/console` + `/admin/payouts`,
`consume_rate_limit`, `Money.svelte`/`BountyMeter.svelte`/`formatCents`, the design tokens.

> **⚠ Cross-branch dependency (verified 2026-06-08 against `docs-money-platform-plan`).** Phase 6
> reuses the **Lab AI seam `src/lib/server/ai.ts`**, the **Lab draft editor + `PublishDialog`**, and
> the **`/admin/ideas`** moderation route. **None of these exist on this branch** - they live on the
> unmerged `feat-ideas-lab` branch. Phase 6 therefore has a hard prerequisite: **merge `feat-ideas-lab`
> to `main` before starting Phase 6**, or Phase 6 must add its own `ai.ts` seam. Phases 0–5 and 7 have
> no dependency on Lab code. Every other reuse target below was confirmed present on this branch.

---

## Current-code diff + verification matrix

This is the source of truth for *what changes* and *the test that proves it changed*. Every row's
test is written to **fail against the code on this branch today** (see "Fails today because…") and
**pass only after** the row's change lands - see **Verification discipline** below for the rule.

Object existence was verified by reading the migrations and `src/` on `docs-money-platform-plan`.

| Ph | Target artifact | Exists today? | Diff: current → target | Red→green test (fails on old, passes on new) |
|----|-----------------|---------------|------------------------|----------------------------------------------|
| 0 | `platform_config` table | **No** | - → 1-row config (`fee_bps`, `funding_enabled`, `min_withdrawal_cents`), world-read / admin-write | `platform_config_test.sql`: `has_table` (fails today - table absent); exactly-1-row; non-admin UPDATE denied, admin allowed |
| 0 | `src/lib/fee.ts` `splitFee` | **No** (only `money.ts:23 formatCents`) | - → pure `splitFee(amt,bps)→{feeCents,netCents}` | `fee.test.ts`: `splitFee(10000,450)→{450,9550}`, `(x,0)→{0,x}`, `fee+net===amt` fuzz. Fails today: module not found |
| 0 | `src/lib/server/config.ts` `getPlatformConfig` | **No** | - → cached-per-request reader | covered by Phase-2 integration; unit: returns seeded defaults. Fails today: module not found |
| 1 | `ledger_entries` + `account_balances` view + `post_ledger()` | **No** | - → append-only double-entry ledger + derived balances + DEFINER poster | `ledger_test.sql`: `has_table`/`has_function` (fail today); per-txn sum=0 invariant; idempotency_key replay = no-op; client INSERT/UPDATE/DELETE RLS-denied; balance view = hand-sum |
| 1 | `src/lib/server/ledger.ts` `getBalances`/`getLedger` | **No** | - → typed read helpers | unit + Phase-2 integration. Fails today: module not found |
| 2 | `credit_balance` / `escrow_pledge` / `release_grant` / `refund_funder` / `admin_credit_offplatform` RPCs | **No** | - → DEFINER, pinned `search_path`, idempotent, ledger-posting | `money_rpcs_test.sql`: `has_function` ×5 (fail today); full lifecycle balanced; fee→`platform_treasury`; non-admin denied release/admin RPCs; all no-op when `funding_enabled=false` |
| 2 | `admin_approve_payout` (in `answer_rpcs.sql:153`) | **Yes** - records decision only (`admin_approved_at`), posts nothing to money | extend → also call `release_grant` when `funding_enabled`; **charitable gate kept** | `money_rpcs_test.sql`: after existing verify→approve with funding on, `idea_funding`→`released` + a `payable` ledger row exists. Fails today: no ledger row is created (function doesn't touch money) |
| 3 | `src/lib/server/stripe.ts` seam | **No** | - → mockable Stripe client (like the Lab `ai.ts` pattern) | `stripe.test.ts` exercises the mock. Fails today: module not found |
| 3 | `/api/fund/+server.ts` | **No** | - → `POST`→Checkout session (auth + `rateLimit('donate')` + `funding_enabled`) | `fund.test.ts`: guards + session creation (Stripe mocked). Fails today: route 404 |
| 3 | `/api/webhooks/stripe/+server.ts` | **No** | - → sig-verify + dedupe → `credit_balance` | `stripe.test.ts`: bad sig→400; replayed `event.id`→no-op. integration: webhook→`credit_balance`→balances |
| 3 | `stripe_events` / `stripe_customers` tables | **No** | - → dedupe + customer map | `stripe_test.sql`: `has_table` ×2 (fail today) |
| 3 | `donate` rate bucket - **two files** | **No** (`rate_limits.sql:34` case + `rate-limit.ts:10 BUCKETS` both lack it) | add arm in SQL `case` **and** `'donate'` in TS `BUCKETS` | `rate_limits_test.sql`: `consume_rate_limit('donate')` does **not** raise. Fails today: raises `unknown rate-limit bucket: donate` |
| 3 | `ideas/[slug]/+page.svelte` fund panel | **Yes** - "Pledge an amount" → inserts `idea_funding` committed (action at `+page.server.ts:121`) | when `funding_enabled`: "Fund this idea"→Checkout; else current pledge | `funding.spec.ts` (extended): Checkout redirect when on; pledge fallback when off |
| 4 | `stripe_connect_accounts` + `request_withdrawal` RPC | **No** | - → onboarding state + DEFINER withdrawal poster | `connect_test.sql`: `has_table`/`has_function` (fail today); withdraw blocked above `payable`, below `min`, or `payouts_enabled=false`; idempotent |
| 4 | `/api/connect/onboard` + `/api/withdraw` | **No** | - → Connect link + withdraw POST | `withdraw.test.ts`/`connect.test.ts` (Stripe mocked); e2e onboard→withdraw. Fails today: route 404 |
| 4 | `withdraw` + `kyc` rate buckets - **two files** | **No** | add to SQL `case` **and** TS `BUCKETS` | `rate_limits_test.sql`: both buckets don't raise. Fails today: `unknown rate-limit bucket` |
| 4 | dashboard "Payouts" section | **No** (`dashboard/+page.server.ts` has follows/funding, no balance) | - → balance + onboard/withdraw CTA + history | `dashboard.spec.ts` (extended): payable balance + withdraw CTA render |
| 5 | `expert_invites` + `redeem_expert_invite()` | **No** (`experts` table ready: `status`/`approved_by` at `identity.sql:32`) | - → invite tokens + DEFINER redeem→approved expert | `expert_invites_test.sql`: `has_table`/`has_function` (fail today); redeem→`experts.status='approved'`; expired/maxed/invalid refused; non-admin can't create |
| 5 | `/admin/invites` + `/invite/[token]` + `/onboarding/expert` | **No** | - → create/list/revoke + capture+redeem + onboarding | `invite-flow.spec.ts`: open link→signup→publish straight to `open`. Fails today: route 404 |
| 6 | `ideas` template columns (`resolution_criteria_md`, `methodology_md`, `theory_of_change_md`, `extensions_md`) | **No** (`ideas` has `summary_md`/`claim` only, `ideas.sql:23`) | - → 4 nullable columns; regen `database.ts` | `idea_template_test.sql`: `has_column` ×4 (fail today) |
| 6 | `src/lib/server/lab/audit.ts` | **No** - **and its dep `ai.ts` is not on this branch** (see ⚠ above) | - → `auditAgainstTemplate` via `generateStructured` | `audit.test.ts`: schema parse, mocked AI. **Blocked until `feat-ideas-lab` merged** |
| 6 | authoring UI (`/console` form + Lab editor + `PublishDialog`) | `/console` **yes**; Lab editor + `PublishDialog` **not on this branch** | render template sections (optional) | component test: optional sections render/hide. **Lab editor edits blocked until merge** |
| 7 | `src/lib/server/email.ts` (Resend seam) | **No** | - → mockable seam + 4 templates | `email.test.ts`: right template+recipient per event (Resend mocked, **no live sends**). Fails today: module not found |
| 7 | `profile_earnings` view | **No** | - → lifetime sum of released+approved grants | `earnings_test.sql`: view sums only released+admin-approved (excludes merely-verified). Fails today: relation absent |
| 7 | `/u/[handle]` earnings display | **Yes** - profile exists, no earnings (`profile.test.ts` present) | add lifetime-earnings block (reuse `Money.svelte`) | `profile.test.ts` (extended): winner profile shows correct total |

---

## Verification discipline (red→green, 100% of changes covered)

**The rule.** Every phase is TDD-first. Each change in the matrix above ships with the listed test,
and **that test must fail against the code on this branch before the change and pass after** - the
"Fails today because…" / "fails today" notes record the *exact* reason each starts red. A test that
already passes on unchanged code proves nothing and is rejected in review.

Concretely:

1. **pgTAP files open with existence guards** (`has_table`, `has_function`, `has_column`) so a missing
   object is a hard red, never a silently-skipped test. Write and run them *first* - confirm red -
   then build the migration to green.
2. **Vitest seams** (`fee`, `stripe`, `email`, `audit`, `ledger`, `config`) start red as
   *module-not-found*; that is the intended first failure. No seam is implemented before its test exists.
3. **Route specs** assert a real 404/guard on the current tree, then the new behavior - e.g.
   `/api/fund` returns 404 today, 200/redirect after.
4. **Two-place invariants get a dedicated test.** Rate buckets exist in `rate_limits.sql` *and*
   `rate-limit.ts:10 BUCKETS`. The bucket test asserts `consume_rate_limit('<bucket>')` does not raise
   (catches the SQL side) and a TS unit asserts `BUCKETS.includes('<bucket>')` (catches the type side).
   Adding to only one file leaves one test red.
5. **The "extend, don't replace" rows are the trap.** `admin_approve_payout` already passes its
   existing tests - its new test asserts the *new* effect (a `payable` ledger row appears after
   approval when `funding_enabled`), which is impossible on current code because `ledger_entries`
   doesn't exist. That impossibility is the red→green guarantee.
6. **A phase is "done"** only when its new tests are green **and** the full pre-existing suite
   (typecheck · vitest · pgTAP · build · Playwright) stays green. Known baseline: `answers_test.sql`
   has a pre-existing unrelated pgTAP failure - record its status before the phase so a *new* break is
   distinguishable from the baseline.
7. **CI gate.** The new tests are added to the same CI job as the existing suite; no phase merges with
   a red it introduced. Stripe/Resend/AI are **always mocked in CI** - zero live calls, zero live keys.

---

## Phase 0 - Config & feature flags (no money) *(plan §4.3, §10)*

**Scope:** Single source of truth for the fee + a global kill-switch, so everything downstream
reads one place and launch/rollback is a config flip.

**Files:**
- Create: `supabase/migrations/<ts>_platform_config.sql` - table `platform_config` (single row,
  `id bool primary key default true check (id)`, `fee_bps int not null default 450 check (fee_bps between 0 and 2000)`,
  `funding_enabled bool not null default false`, `min_withdrawal_cents int not null default 100`,
  `updated_at`, `updated_by`). World-readable RLS; admin-only update; no insert/delete (seed the
  one row in the migration).
- Create: `src/lib/server/config.ts` - `getPlatformConfig(supabase)` (cached per request).
- Create: `src/lib/fee.ts` - pure `splitFee(amountCents, feeBps) → { feeCents, netCents }`
  (banker's-rounding rule documented; fee floored, net = amount − fee).
- Test: `src/lib/fee.test.ts`, `supabase/tests/database/platform_config_test.sql`.

**Acceptance:**
- `splitFee(10000, 450)` → `{feeCents: 450, netCents: 9550}`; `splitFee(x, 0)` → `{0, x}`; never
  loses a cent (`fee+net===amount`) for fuzzed inputs.
- pgTAP: non-admin cannot update `platform_config`; admin can; exactly one row always.

**Tests:** unit (fee math, incl. rounding + 0 + boundary), pgTAP (RLS).

---

## Phase 1 - Ledger & balances (no external money) *(plan §4.2, §9)*

**Scope:** The authoritative append-only money record + derived per-account balances. All later
money RPCs post here. Pure internal - no Stripe yet.

**Files:**
- Create: `supabase/migrations/<ts>_ledger.sql`:
  - `ledger_entries` (append-only): `id, created_at, kind text check (kind in ('donation','fee','escrow','release','refund','withdrawal','offplatform_credit','adjustment')), account text check (account in ('funder','bounty','platform_treasury','payable','external')), profile_id uuid null, idea_id uuid null, answer_id uuid null, amount_cents bigint not null, currency text default 'USD', idempotency_key text unique, stripe_event_id text null, note text, created_by uuid`. Double-entry enforced by RPCs (each money op writes balanced pairs). **No UPDATE/DELETE policy** (append-only); SELECT: own rows or admin.
  - View `account_balances` - per `profile_id`: `available_cents`, `escrowed_cents`,
    `payable_cents` derived by summing signed ledger rows by `account`.
  - Helper `post_ledger(...)` `SECURITY DEFINER` internal fn used only by other RPCs (not granted
    to `authenticated`) - writes a balanced set + enforces idempotency.
- Create: `src/lib/server/ledger.ts` - typed read helpers (`getBalances`, `getLedger`).
- Test: `supabase/tests/database/ledger_test.sql`.

**Acceptance:** every RPC-posted transaction is balanced (sum of a transaction's entries = 0 across
accounts); re-posting the same `idempotency_key` is a no-op; `account_balances` matches hand-summed
ledger; clients cannot INSERT/UPDATE/DELETE ledger rows directly (RLS).

**Tests:** pgTAP - balanced-posting invariant, idempotency, RLS deny, balance-view correctness.

---

## Phase 2 - Money RPCs wired to the existing funding/answer models *(plan §4.1)*

**Scope:** The internal money state machine, posting to the ledger and reusing `idea_funding` /
`answers` statuses + the existing answer RPCs. **Still no Stripe** - RPCs are called with
test/internal credits so the whole lifecycle is testable before external money.

**Files:**
- Create: `supabase/migrations/<ts>_money_rpcs.sql` - `SECURITY DEFINER`, pinned `search_path`,
  idempotent, each posts via `post_ledger`:
  - `credit_balance(p_profile, p_amount, p_idempotency_key, p_source)` - funder balance += amount
    (used by Stripe webhook in Phase 3 and by admin off-platform credit). **Applies the fee split**
    (plan §4.2, decision #10): records `fee` → `platform_treasury`, net → funder `available`.
  - `escrow_pledge(p_idea, p_amount, p_idempotency_key)` - moves funder `available`→`escrowed`,
    sets/updates an `idea_funding` row to `escrowed` (reuse existing table). Guarded by
    `funding_enabled`.
  - `release_grant(p_answer, p_idempotency_key)` - **callable only after** the existing
    `admin_approve_payout` gate has fired (checks `answers.admin_approved_at`); moves the answer's
    `payout_amount_cents` from the idea's `escrowed` → submitter `payable`; flips the matching
    `idea_funding` to `released`. Reuses `answers.payout_amount_cents` set by `verify_answer`.
  - `refund_funder(p_funding_id, p_idempotency_key)` - `escrowed`→`available` (or external refund in
    Phase 3); reuses `idea_funding.status='refunded'`.
  - `admin_credit_offplatform(p_profile, p_amount, p_note)` - admin-only; same fee split as Stripe.
- Extend (do NOT replace): `admin_approve_payout` (in `answer_rpcs.sql`) to call `release_grant`
  when `funding_enabled` - keep the charitable gate intact.
- Test: `supabase/tests/database/money_rpcs_test.sql`.

**Acceptance:** full lifecycle (credit → escrow → verify(existing) → admin-approve(existing) →
release → payable) leaves ledger balanced and `idea_funding`/`answers` statuses correct; fee lands
in `platform_treasury` on every credit; a non-admin cannot call admin/release RPCs; everything is a
no-op when `funding_enabled=false` (except internal test credits); idempotency holds.

**Tests:** pgTAP - the happy lifecycle, fee split, RLS/role guards, `funding_enabled` gating,
idempotency, refund.

---

## Phase 3 - Stripe intake: Checkout + webhooks (test mode) *(plan §4.1, Requirement A)*

**Scope:** Real card donations in **test mode**, routed to Apart, crediting balance/bounty via the
Phase-2 RPCs; tax-receipt metadata.

**Files:**
- `npm i stripe`; env `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (server-only, `$env/dynamic/private`).
- Create: `src/lib/server/stripe.ts` - Stripe client seam (mockable, like `ai.ts`).
- Create: `src/routes/api/fund/+server.ts` - `POST {idea_id?, amount_cents}` → creates a Stripe
  **Checkout** session (mode=payment, to Apart), with metadata `{profile_id, idea_id?, kind:'donation'}`;
  returns the session URL. Guards: auth, `rateLimit('donate')`, `funding_enabled`.
- Create: `src/routes/api/webhooks/stripe/+server.ts` - verifies the signature, dedupes on
  `stripe_events`, on `checkout.session.completed` calls `credit_balance` (+ `escrow_pledge` if an
  `idea_id` was set) with `idempotency_key = event.id`. Returns 200 fast.
- Create: `supabase/migrations/<ts>_stripe.sql` - `stripe_events(id text pk, type, created_at)` for
  dedupe; `stripe_customers(profile_id pk, stripe_customer_id)`.
- UI: extend the idea fund panel (`src/routes/ideas/[slug]/+page.svelte`) - the "Pledge" action
  becomes "Fund this idea" → Stripe Checkout (card) when `funding_enabled`, else the current
  no-money pledge. Add a tax-receipt note. Reuse the green meter.
- Test: `src/routes/api/fund/fund.test.ts`, `webhooks/stripe.test.ts` (Stripe + RPC mocked);
  `e2e/funding.spec.ts` extended.

**Acceptance:** a test-mode Checkout completion credits the funder (net) + platform fee via the
ledger; a replayed webhook event is a no-op (dedupe + idempotency); bad signature → 400; funding
disabled → intake refused.

**Tests:** unit (route guards, session creation, webhook signature + dedupe - Stripe mocked),
**integration** (webhook → `credit_balance` → balances), **e2e** the Stripe **test** Checkout flow
(Stripe CLI `trigger` or test card in a stubbed session).

---

## Phase 4 - Payouts: Stripe Connect Express + withdrawals *(plan §4.1 step 6, decision #4)*

**Scope:** Researchers onboard to Connect Express (KYC + tax forms) and withdraw their `payable`
balance; manual-grant fallback for admins.

**Files:**
- Create: `supabase/migrations/<ts>_connect.sql` - `stripe_connect_accounts(profile_id pk,
  stripe_account_id, onboarding_status, payouts_enabled bool)`; rate buckets `withdraw`, `kyc`.
- Create: `src/routes/api/connect/onboard/+server.ts` - creates/links a Connect Express account,
  returns the onboarding link. `src/routes/api/connect/webhook` (or extend the Stripe webhook) for
  `account.updated` → `payouts_enabled`.
- Create: `src/routes/api/withdraw/+server.ts` - `POST {amount_cents}` → validates `payable >=
  amount >= min_withdrawal_cents`, `payouts_enabled`, then `request_withdrawal` RPC (moves
  `payable`→`withdrawal` ledger, creates a Stripe Transfer/Payout). `rateLimit('withdraw')`.
- RPC `request_withdrawal` in a migration (`SECURITY DEFINER`, idempotent).
- Admin manual-grant action on `/admin/payouts` - mark a `payable` grant as paid off-platform
  (ledger `withdrawal` + note), for the early fallback path.
- UI: a "Payouts" section on the dashboard - balance, onboard-to-withdraw CTA, withdraw form,
  history. Reuse `Money.svelte`.
- Test: `withdraw.test.ts`, `connect.test.ts` (Stripe mocked); pgTAP for `request_withdrawal`
  (threshold, payouts_enabled, idempotency); **e2e** the onboard→withdraw flow (Connect mocked).

**Acceptance:** can't withdraw above payable or below the min, or without `payouts_enabled`; a
withdrawal posts a balanced ledger transaction once (idempotent); admin manual-grant reconciles the
same way.

---

## Phase 5 - Expert invites → instant expert *(plan §5, Requirement B)*

**Scope:** Admin-generated invite links that make the signup an approved expert immediately, plus
onboarding.

**Files:**
- Create: `supabase/migrations/<ts>_expert_invites.sql` - `expert_invites(id, token unique,
  created_by, max_uses int default 1, used_count int default 0, expires_at, created_at, specialty)`;
  RPC `redeem_expert_invite(p_token)` `SECURITY DEFINER`: validates token (unexpired, uses left),
  upserts `experts` for `auth.uid()` as `status='approved', approved_by=created_by`, increments
  `used_count`. RLS: admin manages invites; redeem via RPC only.
- Create: `src/routes/admin/invites/+page.*` - admin creates/lists/revokes invite links.
- Create: `src/routes/invite/[token]/+page.server.ts` - capture token → after auth, call
  `redeem_expert_invite` → redirect to expert onboarding. (Token survives the OAuth/login round-trip
  via the `next` param, mirroring existing `/login?next=` usage.)
- Create: `src/routes/onboarding/expert/+page.svelte` - explains how to write a good idea (the §6
  template), links to authoring.
- Test: `expert_invites_test.sql` (pgTAP: redeem makes approved expert; expired/used token fails;
  non-admin can't create); **e2e** `invite-flow.spec.ts`: open invite link → sign up → land as an
  expert who can immediately publish to `open` (verifies the gating trigger sees them as expert).

**Acceptance:** a fresh user opening a valid invite link becomes an approved expert on signup and
can publish an idea straight to `open`; expired/maxed/invalid tokens are refused; non-experts still
route to the review queue (existing gating, unchanged).

---

## Phase 6 - Structured idea template + light AI audit *(plan §6, §7, Requirement C/D)*

**Scope:** The Manifund-style optional sections (shared by experts + non-experts) and an assistive
AI structure-check on ideas & answers.

**Files:**
- Create: `supabase/migrations/<ts>_idea_template.sql` - add nullable `ideas` columns:
  `resolution_criteria_md`, `methodology_md`, `theory_of_change_md`, `extensions_md`. (Reuse
  `summary_md` for the summary.) Regenerate `src/lib/types/database.ts`.
- Extend authoring UI: `/console` create form + the Lab draft editor + `PublishDialog` - render the
  template sections as optional prefilled headers. **Same template for experts and non-experts.**
- Idea detail (`src/routes/ideas/[slug]/+page.svelte`) - render the present sections.
- Create: `src/lib/server/lab/audit.ts` - `auditAgainstTemplate(kind, text)` using `generateStructured`
  (the existing AI seam) → `{ missingSections[], notes[] }`. Surfaced as an **assistive** banner on
  submit (idea & answer); never blocks. Gated/rate-limited like the Lab AI endpoints.
- Endpoint: `src/routes/api/audit/+server.ts` (or fold into existing submit actions).
- Test: pgTAP (columns + RLS unchanged), unit (audit schema parse, mocked AI), component (template
  renders optional sections; empty sections hidden).

**Acceptance:** ideas/answers can be authored with any subset of sections; the audit surfaces
missing/mismatched sections as a non-blocking hint; ownership rule intact (no import path added).

---

## Phase 7 - Email notifications + earnings display *(plan §7, §8, Requirement D/E)*

**Scope:** Transactional emails on the key money/verification moments, and public lifetime earnings.

**Files:**
- `npm i resend`; env `RESEND_API_KEY` (server-only). Create `src/lib/server/email.ts`
  (mockable seam; templates: answer-submitted→owner, decision→submitter, queue-item→admins,
  payout-released→winner). Triggered from the existing answer RPCs' callers / a DB→edge hook
  (call the email seam from the server actions that invoke the RPCs, not from SQL).
- Create: `supabase/migrations/<ts>_earnings.sql` - view `profile_earnings(profile_id,
  lifetime_cents, payout_count)` = sum of **released + admin-approved** grants per submitter
  (decision #9), world-readable.
- Extend `src/routes/u/[handle]/+page.server.ts` + `+page.svelte` - show lifetime earnings
  (reuse `Money.svelte`, the design tokens).
- Test: unit (email seam called with right template/recipient on each event, mocked Resend), pgTAP
  (earnings view sums only released+approved), component (profile shows earnings; $0 hidden or
  shown per design).

**Acceptance:** each event sends exactly one email to the right recipient (mocked in CI - **no live
sends**); a winner's profile shows the correct lifetime total; earnings exclude merely-verified
(not-yet-approved) payouts.

---

## Phase 8 - Launch / cutover *(plan §10)*

**Scope:** Flip from test to live safely.

**Steps & acceptance:**
1. All Phases 1–7 green (unit + pgTAP + integration + e2e), `funding_enabled=false`, Stripe **test**.
2. **Gate 0:** counsel sign-off recorded (HUMAN STEP). Until then, no live keys.
3. Apply all migrations to cloud; set **live** Stripe + Resend keys in Vercel (server env).
4. Set `platform_config.fee_bps` to the agreed value; flip `funding_enabled=true`.
5. Generate the first expert invite links; invite the launch experts.
6. **Rollback:** `funding_enabled=false` (intake/escrow/withdraw refuse instantly) and/or
   `fee_bps=0`; ledger is append-only so state is always reconstructable; swap Stripe keys back to
   test. A documented runbook in the PR.

---

## Migration summary (new tables/columns/RPCs)

| Migration | Adds |
|---|---|
| `platform_config` | fee_bps, funding_enabled, min_withdrawal_cents (1-row, admin-writable) |
| `ledger` | `ledger_entries` (append-only) + `account_balances` view + `post_ledger` |
| `money_rpcs` | `credit_balance`/`escrow_pledge`/`release_grant`/`refund_funder`/`admin_credit_offplatform`; extend `admin_approve_payout` |
| `stripe` | `stripe_events`, `stripe_customers` |
| `connect` | `stripe_connect_accounts`; `request_withdrawal`; rate buckets withdraw/kyc |
| `expert_invites` | `expert_invites` + `redeem_expert_invite` |
| `idea_template` | `ideas.resolution_criteria_md/methodology_md/theory_of_change_md/extensions_md` |
| `earnings` | `profile_earnings` view |
| (rate-limit) | add `donate`/`withdraw`/`kyc` buckets - **two places**: the `case` in `consume_rate_limit` (`rate_limits.sql`) **and** the `BUCKETS` array (`rate-limit.ts:10`) |

All money mutations are `SECURITY DEFINER` + idempotent + ledger-posting; **no service-role client**.

## Testing strategy (every phase)

> The **Current-code diff + verification matrix** and **Verification discipline** sections above are
> the authoritative per-artifact test list (each row names the test and why it starts red). The
> summary below is the by-layer view.

- **Unit (vitest):** fee math, route guards, Stripe/Resend/AI seams (mocked - **no live calls in
  CI**), audit schema.
- **pgTAP:** ledger balance/idempotency/RLS, money-RPC lifecycle + role guards + `funding_enabled`
  gating, invite redemption, earnings view, template columns.
- **Integration:** webhook → credit → balances; verify→approve→release→payable.
- **e2e (Playwright):** the **Stripe test Checkout** funding flow; the **invite→instant-expert**
  flow (open link → signup → publish to `open`); withdraw onboarding (Connect mocked). The known
  loop animation flake is unrelated.

## HUMAN STEPS (only Esben / Apart) - see plan §11
Gate-0 counsel sign-off · Stripe account (Checkout + Connect Express, test+live keys, webhook
secret) · Apart banking + wire workflow · Resend account + sender domain · tax (1099/1042-S via
Connect, W-9/W-8BEN) · decide + invite first experts · funder pitches · set `fee_bps` at go-live.

## Remaining open questions (defaults in plan §12; revisit per phase)
Balance-vs-direct-fund both (default); review-queue reuses archived (default); auto-resolve refunds
funders (default); min withdrawal $1 (default); tax-doc status-only (default); invite limited-use +
expiry (default). Confirm during the relevant phase if any should change.
