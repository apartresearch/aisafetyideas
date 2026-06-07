# AI Safety Ideas — Phase 1 Launch Checklist

> Phase 1 = the modern, RLS-secured platform with **money OFF** (payouts are *recorded intended
> amounts*, no funds move). This checklist takes the merged codebase to a real public launch.
> Owner actions (only the owner can do them) are marked **[OWNER]**.

Last updated: 2026-06-07.

---

## 1. Code & CI (status: essentially done)

- [x] Plans 1–5 merged (auth/profiles/experts · ideas/categories · answers/verification · funding pledges/dashboards · comments/interest/sanitizer).
- [x] ETL Restore v1 (265 users + 238 ideas) and v2 (comments/interest/results→answers/likes→votes) applied to production.
- [x] App-wide rate limiting (DEFINER RPC, no service-role) — PR #51.
- [x] Verify→payout signature animation — PR #52.
- [x] Authed E2E suite + CI `e2e` job — PR #53 *(merge if not already)*.
- [ ] Form input-binding fix — PR #54 *(merge; minor UX hardening surfaced by E2E)*.
- [ ] CI green on `main` after all merges (`app` · `db` · `e2e` jobs).
- [ ] (Optional, non-blocking) Bump `actions/checkout`/`setup-node`/`setup-cli` for the Node-20→24 deprecation (deadline 2026-09).

## 2. Production database (Supabase `gjomchhbsbtauzkpyjwa`, "Seldon Lab" org)

- [x] All Phase-1 migrations applied; ETL data loaded; advisors at the accepted baseline (the SECURITY-DEFINER-executable WARNs for the self-authorizing RPCs + the rate_limits `rls_enabled_no_policy` INFO are intentional).
- [ ] **[OWNER]** Enable **Leaked Password Protection** (Auth → Providers/Policies → HaveIBeenPwned).
- [ ] **[OWNER]** Confirm **Google OAuth** is configured for production (client id/secret in the Supabase Auth dashboard) and the **redirect URLs** include the production domain's `/auth/callback`.
- [ ] **[OWNER]** Verify the Auth **Site URL** + additional redirect URLs match the production domain (not localhost).
- [ ] **[OWNER]** Email templates / SMTP for magic-link sign-in are production-ready (custom SMTP if not using the Supabase default sender).
- [ ] **Migration-history note:** the first 8 migrations' versions in cloud `schema_migrations` differ from the repo filenames (early MCP `apply_migration` used application-time stamps). Harmless for the running app, but **`supabase db push` will fail** until realigned. Realign SQL is staged (rewrites history versions only, no schema/data change) — apply it only if/when you adopt `db push`.

## 3. Secrets & access hygiene **[OWNER]**

- [ ] **Revoke the Supabase Management-API PAT** used for this session's cloud ETL/migrations (account → tokens).
- [ ] **Rotate the cloud DB password** (it was pasted into the assistant session during the v1 load).
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY` is **not** referenced anywhere in app code (it isn't — owner principle) and is not exposed in Vercel client env.
- [ ] Re-authenticate the **Supabase MCP** if you want it back (deauthed since Restore v2; the Management API covered everything since).

## 4. Vercel deploy

- [ ] **[OWNER]** Production env vars set (Production + Preview scopes): `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` (the app reads these at runtime via `$env/dynamic/public`). Service role NOT set as a `PUBLIC_` var.
- [ ] **[OWNER]** Production domain attached + DNS verified; HTTPS enforced.
- [ ] Confirm `@sveltejs/adapter-vercel` build succeeds on Vercel with Node 24.
- [ ] Promote a production deployment; verify a Preview deployment also functions at runtime.

## 5. Post-deploy smoke (against production)

- [ ] Public browse: `/ideas`, `/ideas/[id]`, `/experts` render with restored data; `/ideas?sort=top` orders by votes.
- [ ] **[OWNER]** Sign in with Google (`esben@apartresearch.com`) → lands in the restored admin account.
- [ ] An old community member can sign in (magic link or Google) — credentials restored verbatim.
- [ ] Post an idea (expert) → pledge (funder) → submit answer → verify (the seal + count-up plays) → admin approve → intended payout recorded.
- [ ] Comment, vote, express interest all work; rate limiting returns a friendly message only under abuse.
- [ ] Reduced-motion OS setting → animations jump to final.

## 6. Phase-1 acceptance (definition of done)
- [ ] All §1–§5 boxes checked; CI green on `main`; advisors at baseline.
- [ ] No real money moves anywhere (donation/escrow/withdrawal rails remain flagged off).

---

## Phase 2 (real money) — NOT launch-blocking, tracked separately
Gated on legal/financial sign-off; out of scope for the Phase-1 launch. Scope (to be brainstormed):
- 501(c)(3)/fiscal-sponsor donate→grant flow (avoids money-transmitter licensing — donate-then-grant, not a blanket charity exemption).
- Stripe Connect (+ PayPal/Wise) rails; internal USD ledger; escrow-at-pledge → payout-on-verify; withdrawals.
- Signed Stripe webhooks; append-only ledger with invariants (balance ≥ 0, payout ≤ escrow, idempotency); auto-resolve timeout so silent authors can't trap escrowed funds.
- Tax: 1099-NEC / W-8BEN / 1042-S handling for global submitters.
- Heaviest test coverage in the codebase (ledger invariants).
- **Requires counsel + nonprofit/fintech sign-off before any real funds.**
