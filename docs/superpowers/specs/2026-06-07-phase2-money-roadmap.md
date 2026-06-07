# Phase 2 (Real Money) — Scoping Roadmap

**Date:** 2026-06-07 · **Status:** scoping decomposition (NOT a buildable spec)
**Owner-confirmed framing:** full donate→escrow→payout→withdraw chain launched together · Stripe Connect
first (PayPal/Wise/USDC later) · designed around **Apart Research's 501(c)(3)/fiscal sponsor**.

> This is a **decomposition into ordered sub-projects**, not an implementation spec. Each component
> below gets its own brainstorm → spec → plan → build cycle (this session's cadence) **after Gate 0**.
> **No real funds move until counsel/fintech sign-off (Gate 0).** The whole build can proceed in
> **Stripe test mode** in parallel with the legal work.

## What already exists (Phase 1, money OFF)
The payment-complete schema is in place and waiting:
- `public.idea_funding` — statuses `committed | escrowed | released | refunded`, `amount_cents` (>0, ≤ $1M cap), `currency`. Client INSERT pins `committed`; **no UPDATE policy** — the escrow/release/refund transitions are reserved for Phase-2 SECURITY DEFINER money RPCs.
- `public.answers` — `payout_amount_cents`, `payout_currency`, and the admin charitable-purpose gate (`admin_approved_by/at`, `admin_rejected_by/at`).
- `bounty_pot` view sums `committed+escrowed`.
- App-wide rate limiting (DEFINER RPC) already covers mutation endpoints.

## Firmed money model (from earlier brainstorming)
Charitable **donate→grant**: funders donate (tax-deductible to Apart Research's 501(c)(3)) → internal
USD balance → **escrow at pledge** → **payout-on-verify** (charitable grant, after the admin gate) →
**withdrawal** to the submitter. Donate-then-grant is what avoids money-transmitter licensing — *not*
a blanket charity exemption. Global submitters from day one. Auto-resolve timeout so a silent author
can't trap escrowed funds. Append-only ledger with invariants. Mirrors Manifund (~5% fee, internal
ledger). **No service-role client in app code — money mutations are SECURITY DEFINER RPCs only**
([[no-service-role-in-app]]).

---

## Gate 0 — Counsel & fintech sign-off (BLOCKS all real-fund work)
Must clear before any component touches real money (test-mode build proceeds in parallel):
- [ ] Confirm the **501(c)(3)/fiscal-sponsor** vehicle (own status vs fiscal sponsor) and that donations are tax-deductible to it; payouts are charitable grants.
- [ ] **Money-transmitter analysis** (FinCEN MSB + state MTLs) confirming the donate-then-grant structure keeps the platform out of money-transmission. *(General info, not legal advice — counsel decides.)*
- [ ] **Stripe Connect platform agreement** + acceptable-use review for the charitable/grant use case.
- [ ] **Tax**: US payees → 1099-NEC thresholds; foreign payees → W-8BEN + 1042-S withholding; data-capture obligations.
- [ ] **State charitable-solicitation registration** where required.
- [ ] Policies to fix (owner + counsel): platform **fee** (~5%?), **minimum payout**, **refund policy**, **auto-resolve default destination** (refund to funder vs hold), Stripe Connect type (**Express** recommended vs Custom).

## Components (dependency-ordered; one money launch)

### A · Ledger & balances — the foundation
- Append-only **double-entry** `ledger_entries` (debit/credit, account, txn group, idempotency key, ref to the originating entity); per-account balances (each user: donor *available*, *escrowed*, submitter *payable*; plus platform fee + Apart charitable accounts).
- SECURITY DEFINER RPCs post **balanced** transactions; **invariants**: per-txn sum = 0; no negative *available*; release ≤ escrowed for a pledge; payout ≤ released; every external-money RPC idempotent on a key.
- **Heaviest test coverage in the codebase**: pgTAP invariant tests + property/fuzz tests (balance-to-zero, no negative, idempotent replays) before anything posts to it.
- *Depends on:* nothing. *Blocks:* B–F.

### B · Donation intake
- Stripe Checkout / PaymentIntent for a donation → **signed webhook** → ledger RPC credits the donor's *available* balance + records a tax-deductible donation + emails a receipt.
- Pre-funded balance model (firmed): donate → balance, then allocate to pledges (vs charge-per-pledge — decided pre-funded).
- *Depends on:* A, F(webhooks). *Blocks:* C.

### C · Escrow at pledge
- Wire `idea_funding` `committed → escrowed`: a money RPC moves donor *available* → *escrowed* hold tied to the pledge. Schema already supports the status; this is the RPC + ledger postings + UI (the pledge flow now debits real balance).
- *Depends on:* A, B. *Blocks:* D.

### D · Payout on verify + admin approve
- On the existing admin charitable-purpose gate, release escrow → submitter *payable* as a **charitable grant** (`idea_funding` `escrowed → released`; `answers` payout already recorded). Hypothesis single-winner vs open-ended multi-payout already modeled in Phase 1 RPCs.
- **Auto-resolve cron** (pg_cron or Vercel cron): if an author neither verifies nor rejects within the timeout, resolve per policy (refund funders or default) so escrow can't be trapped.
- *Depends on:* A, C. *Blocks:* E.

### E · Withdrawals (submitter payouts)
- Submitter **KYC + Stripe Connect (Express)** onboarding; payout from *payable* balance → connected account; **W-9/W-8BEN** capture + **1099-NEC/1042-S** reporting data; minimum-payout + fee applied.
- **Stripe Connect first** (US + ~46 countries); PayPal/Wise/USDC as later increments for unsupported regions.
- *Depends on:* A, D. *Blocks:* nothing (last in the chain).

### F · Webhooks, reconciliation, refunds — spans all
- **Signed, idempotent** Stripe webhooks (the only trusted source of payment truth).
- **Daily reconciliation**: ledger balances ↔ Stripe balance, with drift alerting.
- Refund/cancel (`committed → refunded`; donation refunds), dispute/chargeback handling.
- *Depends on:* A. *Spans:* B–E.

## Cross-cutting
- Admin **money dashboard** + full audit trail (every ledger entry traceable).
- Money endpoints rate-limited (limiter exists; add money buckets).
- **Sandbox E2E** of the full donate→escrow→payout→withdraw flow (extends the Phase-1 Playwright suite, Stripe test mode).
- Observability/alerting on ledger drift, webhook failures, stuck escrow.

## Build order
Gate 0 (parallel test-mode build) → **A → B → C → D → E**, with **F** woven through, launched together.
Each component: brainstorm → spec → 6-lens review → plan → 6-lens review → subagent build → PR.

## Explicitly deferred / out of scope
Regrantor budgets, impact certificates, multi-currency holding, the old map/lists. Crypto (USDC)
only as a post-launch payout increment if needed.
