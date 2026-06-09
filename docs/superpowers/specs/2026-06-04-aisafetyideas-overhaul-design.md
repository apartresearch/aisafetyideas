# AI Safety Ideas - 2026 Overhaul Design Spec

**Date:** 2026-06-04
**Status:** Design approved (brainstorming complete) - pending written-spec review, then implementation plan.
**Owner:** Esben (Apart Research)
**Brand & motion:** see `CLAUDE.md` (source of truth for visual + animation system).

---

## 1. Context & problem

AI Safety Ideas (`aisafetyideas.com`, by Apart Research) was a research-idea aggregator built ~2021–2023 on a now end-of-life stack, dormant since. Two compounding failures force a rebuild:

1. **The production database is unrecoverable.** The Supabase project (`eaqmnttukiyjigdotone`, "AI safety ideas", in the *Apart Research* org) was paused > 90 days; a restore attempt returns *"Project has been paused for more than 90 days and cannot be restored."* No backup exists in the repo or on disk. **All prior data is lost; the schema survives only as code-inferred reconstruction** (see Appendix B).
2. **The stack is EOL.** SvelteKit pre-1.0 (`next` tag), Svelte 3, `@supabase/supabase-js` v1 (removed APIs), the entire `process.env` inlined into the client bundle, no RLS, no SSR, no migrations, client-side `max(id)+1` primary keys (the documented cause of the final bug churn).

**Goal:** rebuild AI Safety Ideas as a **Manifund-style charitable research-bounty platform** aligned to the 2026 funding landscape, on a modern, secure stack.

## 2. Product overview

**The core loop:** admin-vetted **experts** post **ideas** (bounties) → **funders** attach money → **submitters** submit **answers** → the idea **author verifies/rejects** → an **admin approves the charitable-purpose gate** → a **payout** flows to the submitter, who can **withdraw** to a bank.

**Two idea types:**
- **Hypothesis** - a yes/no claim. **Single winner:** the first answer the author verifies takes the pot; the idea resolves.
- **Open-ended** - no fixed answer. **Multiple winners:** the author can verify several answers, each paid from the pot; funders can top up; stays open until the funder closes it or the pot is exhausted.

**Surfaces:** public bounty interface · funder dashboard · expert console · admin.

## 3. Firmed decisions

- **Money model:** charitable, through Apart Research's **501(c)(3) / fiscal sponsor**. Funders **donate** (tax-deductible) into an internal USD balance; payouts are **charitable grants**. The donate-then-grant structure (not a blanket charity exemption) is what keeps the platform clear of money-transmitter licensing. **Legal/tax sign-off required before Phase 2** (Appendix A).
- **Payout model:** hypothesis → single winner (first verified); open-ended → author accepts multiple, each paid, funders can top up.
- **Two approval gates before any payout:** (1) idea author verifies the research; (2) admin approves the charitable-purpose gate.
- **Safeguards:** auto-resolve timeout so a silent author can't trap escrowed funds; "request revision" is distinct from "reject."
- **Submitters:** global from day one.
- **Payment rail:** **Stripe only** - Stripe Connect for payouts, Stripe Global Payouts / stablecoin payouts for wider country reach, Stripe for inbound donations. (No PayPal/Wise/every.org.)
- **Platform fee:** configurable; **decided at Phase 2** (Manifund uses ~5%).
- **Build sequencing:** **phased, with a payment-complete schema from day one and real money OFF in Phase 1.**
- **Stack:** SvelteKit 2 + Svelte 5 (runes), Supabase JS v2 + `@supabase/ssr` (cookie sessions, RLS enforced, typed client), `@sveltejs/adapter-vercel`, Stripe, Tailwind.
- **Repo:** rebuild in-place on a `rebuild-2026` branch (preserves history + `CLAUDE.md`).
- **Content:** clean start with a fresh AI-safety category taxonomy; archive back-fill deferred/optional.

## 4. Roles & permissions

| Role | Capabilities | Gating |
|---|---|---|
| **Visitor** (anon) | Browse public ideas, answers (once verified), experts | - |
| **Member** | Submit answers, follow experts, comment, express interest; becomes a funder by donating | Email / OAuth |
| **Expert / Creator** | Post ideas (bounties); verify / request-revision / reject answers **to their own ideas** | **Admin-vetted** (`experts.status = approved`) |
| **Funder** | Donate, attach money to ideas, dashboard of followed experts | Activity-based (any member who donates) |
| **Admin** (Apart staff) | Vet experts; charitable-purpose gate; withdrawal review; moderation | `profiles.is_admin` |

Roles are capabilities, not exclusive identities (one person may be several). Authorization is enforced **in RLS (source of truth)** and mirrored in UI gating. Roles derive from `is_admin` / `experts.status` - **never** from `user_metadata`.

## 5. Lifecycle state machines

- **Idea:** `draft → open → resolved` (hypothesis) / `open ⇄ topped-up → closed` (open-ended); optional `archived`.
- **Answer:** `submitted → under_review → {verified | revision_requested → resubmitted | rejected}`.
- **Payout gate (post-verify):** `verified → pending_admin → {approved → paid | admin_rejected}`.
- **Auto-resolve:** author inaction past `auto_resolve_days` escalates to admin.

## 6. Data model & schema

UUID PKs, RLS on every table, PII never exposed to anon. DDL is illustrative (key columns).

### Identity & roles
```sql
profiles ( id uuid pk = auth.uid, handle text unique, display_name, avatar_url, bio_md,
           career_stage, links jsonb, is_admin bool default false, created_at )
experts  ( id uuid pk -> profiles, status text (pending|approved|revoked), specialty,
           featured bool, approved_by -> profiles, approved_at )
follows  ( follower_id -> profiles, expert_id -> profiles, primary key (follower_id, expert_id) )
```
A `public_profiles` view exposes only safe columns; **email stays in `auth.users`**.

### Ideas & funding
```sql
ideas ( id uuid pk, author_id -> profiles, type text (hypothesis|open_ended),
        title, summary_md, claim text, status text (draft|open|resolved|closed|archived),
        resolution text (yes|no|ambiguous) null, estimated_hours int, importance int,
        source_url, currency default 'USD', auto_resolve_days int, closes_at null,
        published_at, created_at, updated_at )
categories ( id, slug unique, title, description )
idea_categories ( idea_id -> ideas, category_id -> categories )
idea_relations  ( parent_id -> ideas, child_id -> ideas )         -- "related ideas"
idea_funding ( id uuid pk, idea_id -> ideas, funder_id -> profiles, amount_cents bigint,
               currency, status text (committed|escrowed|released|refunded), created_at )
-- pot = sum(active idea_funding) exposed via a `bounty_pot` view (no mutable column)
```

### Answers (replace the old "results")
```sql
answers ( id uuid pk, idea_id -> ideas, submitter_id -> profiles, title, explanation_md,
          status text (submitted|under_review|revision_requested|verified|rejected),
          verified_by -> profiles null, verified_at,
          admin_approved_by -> profiles null, admin_approved_at,
          payout_amount_cents bigint null, created_at, updated_at )
answer_artifacts ( id, answer_id -> answers, kind text (github|pdf|colab|url|other), url, label )
answer_reviews   ( id, answer_id -> answers, actor_id -> profiles,
                   action text (verify|reject|request_revision|admin_approve|admin_reject),
                   note_md, created_at )                            -- audit trail
```

### Charitable money ledger (append-only double-entry)
```sql
ledger_accounts ( id uuid pk, owner_id -> profiles null,
                  kind text (user|escrow|donations_clearing|platform_fee|external), currency )
ledger_entries  ( id uuid pk, txn_id uuid, account_id -> ledger_accounts, amount_cents bigint,
                  kind text (donation|escrow_hold|payout|refund|withdrawal|fee),
                  idea_id null, answer_id null, donation_id null, created_at )  -- each txn_id sums to 0
donations   ( id, funder_id -> profiles, amount_cents, provider text (stripe|manual),
              provider_ref, tax_receipt_url, status (pending|completed|failed), created_at )
payouts     ( id, answer_id -> answers, recipient_id -> profiles, amount_cents,
              status (pending_admin|approved|paid|failed), approved_by -> profiles, created_at )
withdrawals ( id, requester_id -> profiles, amount_cents, rail text (stripe_connect|stripe_global|
              stablecoin|manual), destination_ref,
              status (requested|under_review|approved|paid|rejected), reviewed_by -> profiles )
recipient_accounts ( id, profile_id -> profiles, rail, external_ref, country,
                     kyc_status, tax_form text (w9|w8ben|none) )
```

### Social / discovery (carried over, sanitized)
```sql
comments ( id, idea_id -> ideas, author_id -> profiles, body_md, reply_to -> comments null, created_at )
interest ( id, idea_id -> ideas, profile_id -> profiles, note_md )
```

### RLS posture
| Table group | Read | Write |
|---|---|---|
| `profiles` (public cols / view) | anyone | self only; email never exposed |
| `ideas` | anyone if `status ≠ draft` | author (if approved expert) / admin |
| `answers` | submitter + idea author + admin; **public once `verified`** | insert: any member; verify/reject: idea author or admin (via RPC) |
| money tables | own rows only | **no client writes - `SECURITY DEFINER` RPCs only**, after `auth.uid()` checks |
| `comments` / `interest` / `follows` | public / owner | owner only |

## 7. Money architecture

Four movements, each an **append-only balanced double-entry transaction**. System accounts: `donations_clearing`, per-user `user`, per-idea `escrow`, `platform_fee`, `external`.

1. **Donation (in):** funder donates $X via Stripe → `donations` row (+ tax receipt) → `+X funder balance, −X donations_clearing`. Money becomes the charity's; sits as the funder's advisory balance.
2. **Escrow (fund an idea):** `−Y funder balance, +Y escrow(idea I)`; `idea_funding → escrowed`. Guard: balance ≥ Y.
3. **Payout (author-verify + admin-approve):** `−P escrow(idea I), +(P−fee) submitter balance, +fee platform_fee`. P = full pot (hypothesis) or author-allocated share (open-ended). Hypothesis → idea `resolved`. Reject at either gate → no payout; escrow remains.
4. **Withdrawal (out):** after KYC/tax (`recipient_accounts`) + review → `−W submitter balance, +W external` → Stripe transfer. Guard: balance ≥ W, KYC complete.

**Refunds:** unspent escrow on a closed idea returns to the funder's **grantable balance**, not their bank (charitable rule; confirm with counsel).

**Invariants (server-enforced):** every txn balances to 0; ledger append-only (corrections = reversing entries); no negative balances; payout ≤ idea escrow; all money RPCs `SECURITY DEFINER` + `auth.uid()` + idempotency keys; Stripe webhooks signature-verified; sessions validated with `getUser()`.

**Phase gating (one switch, no migration):** Phase 1 - donation/escrow/withdrawal RPCs flagged off; `idea_funding` shown as a visible pledge; the verify → admin-approve flow runs fully and records *intended* payouts + audit trail, but no `ledger_entries` fire. Phase 2 - flip the flags; the same RPCs perform real ledger entries + Stripe calls.

## 8. App structure & surfaces

### SvelteKit 2 route tree
```
src/
  app.css                       global design system + tokens (NOT in Nav)
  hooks.server.ts               per-request Supabase server client (@supabase/ssr); getUser()
  lib/server/                   RPC wrappers, Stripe rail adapter, money services
  lib/components/               IdeaCard, BountyMeter, AnswerCard, StatusBadge, Money, RoleGate, MorphCard…
  routes/
    +layout.svelte / +layout.server.ts   shell + session
    +error.svelte                         real error/404
    +page.svelte                          landing + public bounty browse
    ideas/[id]/+page.server.ts            idea + answers (RLS-scoped, paginated)
    ideas/[id]/answer/                    submit an answer
    experts/  experts/[handle]            vetted roster + profile
    u/[handle]                            user profile
    dashboard/                            FUNDER surface
    console/                              EXPERT surface (expert-only)
    admin/                                admin surface
    login/  auth/callback/
```

### Surfaces
- **Public bounty interface** (`/`, `/ideas`, `/ideas/[id]`): browse/search/filter by type, category, status, funding; idea detail with claim, markdown body, pot + funders (`BountyMeter`), related ideas, answers (private-until-verified), submit CTA, comments, interest. Server-paginated.
- **Funder dashboard** (`/dashboard`): feed of followed experts' new ideas; **if none followed, show all experts with follow options**; a **persistent Discover tab** always available; my funded ideas + escrow/outcome; balance + donate (Phase 2 / pledge in Phase 1).
- **Expert console** (`/console`, expert-only): post/edit ideas; review queue (verify / request-revision / reject with notes) - home of the verify→payout interaction.
- **Admin** (`/admin`): vet experts; charitable-purpose gate queue; withdrawal review; moderation.

### Data flow
`hooks.server.ts` builds a request-scoped Supabase client and validates the session with `getUser()`. Reads via `+page.server.ts load()` → **RLS-enforced, paginated, typed**. Writes via **form action → Postgres RPC** (money `SECURITY DEFINER`; rest `SECURITY INVOKER` + RLS). **No global store holding the whole DB**; light client state for interactivity only.

### Auth
Supabase Auth v2 (Google OAuth + email), server-side cookie sessions via `@supabase/ssr`.

## 9. Security & non-functional

### Footguns closed
| Old footgun | Fix |
|---|---|
| Anon read of all tables incl. emails | RLS everywhere; `public_profiles` view; email in `auth.users` only |
| Client `max(id)+1` PKs | DB-generated UUIDs |
| `@html` of unsanitized markdown | server-side render + sanitizer; no raw `@html` of user input |
| `process.env` inlined into bundle | `$env/static/public` for `PUBLIC_*`; service-role key server-only |
| UI-only authorization | RLS source of truth; roles from DB, never `user_metadata` |
| money handling | `SECURITY DEFINER` RPCs + `auth.uid()` + idempotency; signed Stripe webhooks; append-only ledger |

Run `supabase db advisors` after each migration; rate-limit submit/donate endpoints.

### Infra
New Supabase project in the *Apart Research* org (old one unrecoverable), latest Postgres. **All schema + RLS + functions as CLI migrations**, version-controlled; local dev via `supabase start`; typed client via `supabase gen types typescript`. Vercel via `@sveltejs/adapter-vercel`, preview deploys per PR. CI: build · typecheck · test · `db advisors`.

### Testing (TDD)
- **Money = heaviest tests:** ledger invariants (balance-to-zero, no negative balance, payout ≤ escrow, idempotency).
- **RLS policy tests** (pgTAP / Supabase): anon can't read emails or write money.
- **E2E (Playwright):** post idea → fund (sandbox) → submit answer → author verify → admin approve → payout recorded.
- Vitest units/components; verify reduced-motion + a11y per `CLAUDE.md`.

## 10. Phasing

**Phase 1 (relaunch, money OFF):** auth + profiles + roles; expert vetting; ideas (both types) + categories + relations; answers + artifacts + the verify / request-revision / reject flow; the admin charitable-purpose gate (recording intended payouts); funder follows + dashboard (pledges, not money); public browse; comments + interest; full RLS; the new design system + signature interactions. Ships a usable platform and recovers the community.

**Phase 2 (payments ON):** donations (Stripe in) + balances; escrow at post; payout execution on verify+approve; withdrawals + KYC/tax (W-9/W-8BEN, 1099/1042-S); Stripe Connect / Global / stablecoin rails; platform fee. Gated on nonprofit/fintech sign-off. **Additive - no schema migration.**

## 11. Out of scope / deferred
Regrantor *budgets*; impact certificates; the experimental *map*; old *lists/agendas* (may return as a `collections` table for funding-calls/hackathon pages); archive content back-fill.

## 12. External dependencies & risks (need owner / counsel action)
1. **Confirm Apart's charitable vehicle** - own 501(c)(3) or a named fiscal sponsor - and **nonprofit-tax counsel** on grants-to-individuals / DAF rules (IRC §4966/4967).
2. **Fintech/regulatory counsel** sign-off on the donate-then-grant money-transmitter posture before Phase 2.
3. **Stripe account** (Connect + Global Payouts/stablecoin enablement); KYC/tax operational process.
4. **Platform fee** decision (0% vs ~5%).
5. **Expert vetting policy** and initial roster.
*All legal/tax statements in this spec are general information, not legal advice (Appendix A).*

## 13. Brand & motion
Per `CLAUDE.md`: greyscale UI; bright green `#44ff98` as **accent only** (logo, graphs, strokes, progress, focus, the verify→payout mark); Sora + Lora; Linear-style motion with two signature interactions - the **card expand/morph** and the **verify→payout moment**. `prefers-reduced-motion` is a hard gate.

---

## Appendix A - Manifund money model (cited research summary)
Manifund is **Manifold for Charity, Inc.**, a US **501(c)(3)** (EIN 88-3668801) running a **closed internal USD ledger + donor-advised fund** ([ProPublica](https://projects.propublica.org/nonprofits/organizations/883668801)). Money in = a tax-deductible **donation** to the nonprofit; internal moves are ledger transfers; payouts are **charitable grants** (Manifund acts as fiscal sponsor for individuals); recipients withdraw to a bank; it retains ~**5%**. Verification is by a **Manifund admin** (the model adopted here: author + admin). There is **no generic bounty/auto-payout primitive** - our per-submission accept/reject flow is assembled from Algora/Replit/Bountysource patterns (**escrow-at-post + auto-resolve timeout**; Bountysource's collapse is the cautionary tale).
**Verified caveats:** the MT-licensing protection comes from the **donate-then-grant structure, not a blanket charity exemption**; "Stripe is the processor so no MT license" is **only** true for a true pass-through and is *uncertain* when the platform deliberately escrows - **get counsel**. Manifund's exact 1099/W-8BEN practice is undocumented. *(Full cited brief produced via research workflow this session.)*

## Appendix B - Recovered old schema (reference only)
The dead DB held ~16 tables reconstructed from code: `ideas`, `nodes` (lists), `nodes_ideas`, `comments`, `categories`, `problems`, `results`, `users`, and `idea_*_relation` join tables (likes, interest, verification, funding, mentorship, category, problem, idea-idea). FK columns used singular `idea`/`user`; IDs were client-generated integers. This new design **supersedes** it: `results → answers`, `nodes/lists` deferred, integer PKs → UUID, no-RLS → RLS-everywhere, `funding/mentorship` text columns → the charitable ledger.
