# Self-Sustaining Bounty Platform — Human-Readable Plan

> **Status:** Draft for review. This is the **source of truth**; the ExecPlan (phased tasks +
> tests) will be written in strict correspondence with it *after* this is approved.
> **Principle: extend, don't rebuild.** Cited files are real and already in the repo.

## 1. The product, in a paragraph

AI Safety Ideas becomes a **research-bounty flywheel**, run through **Apart Research's
501(c)(3)**. Vetted experts (and, via a review queue, anyone) post well-structured research-idea
bounties. Anyone can fund a bounty — by card or wire — as a **tax-deductible donation to Apart**.
Researchers solve bounties; the idea's owner verifies the answer; Apart grants the bounty to the
winner. The platform keeps the lights on with a **small, configurable fee (default 4–5%)** taken
at funding time — which turns into the growth pitch: *"funders either accept the ~4–5% fee, or
fund us directly to remove it."* Every researcher's profile shows **lifetime money earned**, a
public talent signal that pulls more solvers in. More solved bounties → more credible experts and
funders → more bounties. That's the flywheel.

## 2. Guiding principles (non-negotiable)

- **Extend the existing models** (`idea_funding`, `answers` + the answer RPC suite, `experts`,
  the `/admin/*` queues, the Lab AI seam). Do **not** introduce parallel funding/bounty/answer
  models.
- **Donate-then-grant via Apart's 501(c)(3).** Funders *donate to Apart* (tax-deductible);
  Apart *grants* the bounty to the verified winner. This structure is what keeps us out of
  money-transmitter territory (see `docs/superpowers/specs/2026-06-07-phase2-money-roadmap.md`
  and the regulatory research already done). **No real funds move until counsel signs off
  (Gate 0).**
- **No service-role client, ever.** All money mutations are `SECURITY DEFINER` RPCs self-keyed on
  `auth.uid()`, posting to an append-only ledger — the same pattern as the existing
  `verify_answer` / `admin_approve_payout` RPCs (`supabase/migrations/20260605134020_answer_rpcs.sql`).
- **Honor the design system** (`src/app.css`: greyscale + `#44ff98`, Sora/Lora). The green meter,
  `Money.svelte`, `BountyMeter.svelte`, `IdeaCard.svelte`, and the 501(c)(3) footer note in
  `src/routes/+layout.svelte` all stay and get reused.
- **Ownership rule.** An idea may only be authored on-platform **by its owner**; **no external
  ingestion**. An idea has no valid owner unless that owner created it here and thereby accepts
  responsibility for verifying its answers. (Grep confirms no ingestion code exists today — keep
  it that way.)

## 3. Where we are vs. where we're going (per area, cited)

| Area | Already built (reuse) | New work |
|---|---|---|
| **A. Payments** | `idea_funding` (committed/escrowed/released/refunded, $1M cap, `bounty_pot` view) `20260605155955_idea_funding.sql`; the pledge action + green meter (`src/routes/ideas/[slug]/+page.svelte`, `BountyMeter.svelte`) — **but money is OFF** (a pledge is just a `committed` row); `answers.payout_amount_cents` + admin charitable gate + `admin_approve_payout` RPC | Stripe **intake** (Checkout + wire); **ledger + balances**; **fee** config + split; **payout/withdrawal** (Stripe Connect); **webhooks**; refund/escrow RPCs |
| **B. Roles & invites** | `profiles.is_admin` + `is_admin()`; `experts` (pending/approved/revoked) + `/admin/experts`; **non-expert→archived gating already enforced by triggers** (`20260608081014_open_idea_submissions.sql`, `20260608095408_add_ideas_lab.sql`) + the **`/admin/ideas` review queue** (already built in the Lab PR #63) | **Expert invite links** → instant-expert on signup; expert **onboarding**; admin **invite management**; email-notify admins of new queue items |
| **C. Idea template** | `ideas` (`summary_md`, `claim`, type, slug); authoring via `/console` + the Lab drafts (PR #63); `ideas.expansions` jsonb | **Structured optional sections** (resolution criteria, methodology, theory of change, extensions) as a shared template for experts + non-experts |
| **D. Verification** | Full RPC suite (`start_review`/`verify_answer`/`reject`/`request_revision`/`admin_approve_payout`…) + `answer_reviews` audit trail `20260605134020_answer_rpcs.sql`; `/console` verify UI; `/admin/payouts` gate; the **Lab AI seam** `src/lib/server/ai.ts` | **Email notifications** (owner on answer, submitter on decision, admin on queue); **light AI template-audit** of ideas & answers (reuse the AI seam) |
| **E. Reputation** | `/u/[handle]` profile (`src/routes/u/[handle]/+page.server.ts`) | **Lifetime earnings** (sum of granted bounties) shown publicly |

## 4. The money model (the heart)

### 4.1 The lifecycle of a dollar
1. **Donate.** A funder gives, say, $100 to back a bounty — Stripe Checkout (card) or an
   off-platform wire/ACH. The charge is to **Apart's** Stripe account. The donor gets a
   **tax-deductible receipt for the full $100** (it's a gift to Apart).
2. **Fee split at funding.** Of the $100, the **platform fee** (default 4–5%, configurable, single
   source of truth) is retained as unrestricted support for Apart/the platform; the remainder is
   **earmarked to the bounty**. So $100 → ~$95 to the bounty pot, ~$5 sustains the platform. (The
   pitch: a funder who wants 100% on the bounty simply donates a little extra / a separate
   platform gift to zero out the fee. Fee is trivially settable to 0.)
3. **Escrow.** The earmarked amount moves to `idea_funding.status = 'escrowed'` (held by Apart),
   recorded in the ledger. The existing `bounty_pot` view already sums committed+escrowed.
4. **Solve & verify.** A researcher submits an answer; the **idea owner verifies** it (existing
   `verify_answer` RPC) and an **admin approves the charitable purpose** (existing
   `admin_approve_payout` gate).
5. **Grant.** On approval, the escrowed amount is **released** to the winner as a **charitable
   grant** → their on-platform **payable balance** (ledger posting; reuses `released` status).
6. **Withdraw.** The researcher withdraws to their own account via **Stripe Connect (Express)**,
   which handles KYC + tax forms (1099-NEC / 1042-S) for global researchers. (Manual grant/wire
   by Apart is the fallback path early on.)

### 4.2 Balances, ledger, and off-platform money
- An **append-only double-entry ledger** is the authoritative record; **per-account balances**
  (`available` / `escrowed` / `payable`) are derived/maintained from it. Every money RPC posts to
  it and is **idempotent** on a unique key (internal key + Stripe event id dedupe).
- **On-platform balance (Manifund-style):** a funder can either fund a specific bounty directly,
  or top up a balance and allocate later. Funding is **an action any account can take** — there is
  **no special "funder" role**.
- **Off-platform wires:** when a grant/wire arrives outside Stripe, an **admin manually credits**
  the funder's balance — a ledger entry with no Stripe charge — so off-platform and on-platform
  money reconcile in one place. The **platform fee applies to these too** (same fee split as Stripe
  intake), for a uniform self-sustaining cut.

### 4.3 The fee = the self-sustaining mechanic
A single config row (`platform_config.fee_bps`, default ~450–500 = 4.5–5%) is read everywhere fees
are computed; setting it to 0 disables the fee globally. Fee revenue accrues to a **platform
treasury account** in the ledger. Because the platform earns on *funding volume* (not on a single
funder), it is **not direct-funder-reliant** — it sustains itself as the flywheel turns.

## 5. Roles & invites

- **Expert invite (new):** an admin generates an **invitation link** (a single- or limited-use
  token, optional expiry). Signing up via that link makes the user an **approved expert
  immediately** (`experts.status='approved'`, `approved_by` = the inviting admin). Onboarding then
  shows **how to write a good idea** (the template, §6).
- **Non-experts:** can use everything and submit ideas, but their submissions land in the
  **review queue** — this is *already enforced*: the INSERT/UPDATE gating triggers auto-`archive`
  non-expert submissions, and `/admin/ideas` lists them with a **Promote to open** action. We add
  an admin **email/notification** when a new item hits the queue.
- **Admin:** manages the queue, invites experts, manages invite/referral links — extends the
  existing `/admin/experts`, `/admin/ideas`, `/admin/payouts`.

## 6. Idea authoring template (Manifund-style)

Every idea (expert or non-expert) uses the **same structured template** with **auto-added headline
sections that are optional to fill**: *Idea summary · Methodological notes · Resolution criteria ·
What would be convincing / potential extensions · Theory of change.* Implemented as **nullable
markdown columns** on `ideas` (queryable + AI-auditable), with `summary_md` reused for the summary.
The authoring UI (console + Lab drafts) renders the sections as prefilled headers. **Ownership rule
holds:** authored on-platform by the owner only; no import.

## 7. Answer verification

- On answer submission, **email-notify the idea's owner** to verify; the in-product `/console`
  review UI already exists (verify / reject / request-revision / payout). On a decision,
  **email-notify the submitter**.
- **Light AI audit** (reuse `src/lib/server/ai.ts`): when an idea or answer is submitted, check it
  against the template structure and surface mismatches to the author/admin — **assistive, never a
  hard block**.

## 8. Reputation / earnings

Each profile (`/u/[handle]`) shows **lifetime money earned** = sum of the researcher's **granted**
(released + admin-approved) bounty payouts, via an earnings **view** (no denormalized field to
drift). A public talent signal that incentivizes solving more bounties.

## 9. Data-model changes (overview; exact DDL in the ExecPlan)

- **`platform_config`** — single-row fee config (`fee_bps`, etc.), admin-writable, world-readable.
- **`ledger_entries`** — append-only double-entry money record (account, idea_id?, answer_id?,
  amount_cents, kind, `idempotency_key` unique, stripe_event_id?). The authoritative money log.
- **`account_balances`** (or a view over the ledger) — per-profile `available/escrowed/payable`.
- **`stripe_customers` / `stripe_events`** — map profiles↔Stripe, dedupe webhook events.
- **`expert_invites`** — token, created_by, max_uses/used, expires_at.
- **`ideas`** — add nullable template columns: `resolution_criteria_md`, `methodology_md`,
  `theory_of_change_md`, `extensions_md`.
- **`profile_earnings`** — view: lifetime granted payouts per profile.
- **New money RPCs** (`SECURITY DEFINER`, idempotent, ledger-posting): `donate_credit`,
  `escrow_pledge`, `release_grant`, `refund`, `admin_credit_offplatform`, `request_withdrawal`.
- Reuse/extend, do **not** replace: `idea_funding`, `answers`, `answer_reviews`, the answer RPCs,
  `experts`, `is_admin()`, `consume_rate_limit` (add `donate`/`withdraw`/`kyc` buckets).

## 10. Launch / cutover (narrative; detailed in the ExecPlan)

Build entirely in **Stripe test mode** behind the existing money-OFF posture. Sequence: ledger +
config + fee (no external money) → Stripe **test** Checkout + webhooks → escrow/release wired to
the existing verify/approve gates → Connect **test** payouts → **Gate 0 counsel sign-off** →
flip Stripe to **live** + set `fee_bps` to the agreed value → invite the first experts → open
funding. **Rollback:** set `fee_bps=0` and a global `funding_enabled=false` config flag disables
intake instantly; the ledger is append-only so state is always reconstructable; Stripe
test/live keys are env-swapped.

## 11. HUMAN STEPS (only Esben / Apart can do these — the agent cannot)

1. **501(c)(3) / counsel (Gate 0):** confirm with counsel that donate-then-grant + the fee split is
   sound for Apart's 501(c)(3); confirm tax-receipt language and grant classification. **No live
   money until this clears.**
2. **Stripe account:** create/῾configure Apart's Stripe account; enable **Checkout** + **Connect
   (Express)**; provide test + live keys; set the webhook signing secret. Set keys in Vercel
   (server-only env), not `PUBLIC_`.
3. **Banking:** Apart's bank account for payouts/wires; decide the off-platform wire workflow.
4. **Email provider:** create a transactional-email account (e.g. Resend) + verified sender domain;
   provide the API key (server env).
5. **Tax:** confirm 1099-NEC / 1042-S handling (via Connect onboarding) and W-9/W-8BEN collection.
6. **First experts:** decide the initial expert list; use the invite-link flow to onboard them.
7. **Funder pitches:** the fee-vs-fund-us pitch and any launch funders.
8. **Set `fee_bps`** to the agreed value at go-live (and the test value before).

## 12. Decisions & remaining open questions

**RESOLVED (Esben, 2026-06-08):**
1. **Fee timing** → ✅ **at funding** (donation). Fee → platform treasury; donor receipt = full gift.
4. **Payout rail** → ✅ **Stripe Connect Express** (KYC + 1099/1042-S), manual grant as early fallback.
5. **Open-ended payout** → ✅ **each verified answer gets its own owner-set payout** (the existing
   `verify_answer(p_payout_amount_cents)` model); the pot is a funding pool, the owner allocates a
   grant per verified answer. No automatic pot-splitting.
10. **Fee on off-platform wires** → ✅ **fee applies to ALL funding** (Stripe and admin-credited
    wires alike) — uniform self-sustaining cut.

**Still open — defaults baked in; confirm or override (not blocking the ExecPlan draft):**
2. **Balance vs direct-fund** → support *both* (Manifund-style). *(default)*
3. **Review queue** → *reuse* existing archived-status + `/admin/ideas`; add notifications only,
   no new table. *(default)*
6. **Auto-resolve on timeout** → default **refund funders** when an idea closes unanswered.
7. **Min withdrawal threshold** → configurable, default **$1**.
8. **Tax docs** → via Connect onboarding; store *status*, not documents.
9. **Earnings definition** → lifetime earned = **released + admin-approved** grants only.
11. **Invite link semantics** → **limited-use + optional expiry** (admin sets max-uses/expiry).
