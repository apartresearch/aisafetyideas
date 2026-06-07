# Verify→Payout Signature Animation (design)

**Date:** 2026-06-07 · **Status:** approved by owner (this session)
**Implements:** CLAUDE.md §5 ("★ Verify & payout moment") + §2 motion principles. The product-defining
brand moment — the one place the green accent goes "loud," restrained and earned, never confetti.

## 1. Goal

When an author verifies an answer (and when an admin approves the charitable gate), play a quiet,
deliberate affirmation: a seal draws its check and fills `--green` with a small pop, then the
recorded payout amount counts up with a single green glow on the recipient row. Rejection and
revision get restrained negative motion (a soft horizontal settle + dim). Everything honors
`prefers-reduced-motion` by jumping to final state.

**Money is OFF in Phase 1.** The amount is the recorded `answers.payout_amount_cents` (an *intended*
payout, not a transfer). The label stays "Intended payout" — the animation never implies money moved.

## 2. Owner decisions (this session)

1. **Console `verify` = full moment** (seal + count-up + glow, where the amount is entered);
   **admin/payouts `approve` = lighter** (same seal pop + glow, **no re-count** — the amount is
   unchanged at the gate). One component set, two intensities.
2. **Reject + request_revision animate too** (soft settle + dim / amber settle) — the full
   review-outcome vocabulary in one pass.
3. ~700ms full-moment timing; dismissals quicker than entrances.

## 3. Architecture

Small composable primitives + `use:enhance` orchestration (not one monolith — the seal and
count-up are independently testable and reusable for future metrics per CLAUDE.md §5). Purely
presentational + the enhance conversion: **no RPC/DB changes**.

### 3.1 `src/lib/components/VerifySeal.svelte`
SVG seal. A circle fills `--green` with `scale(1 → 1.12 → 1)` (the `smooth` spring from
`$lib/motion`) while a checkmark draws via `stroke-dashoffset` (offset → 0). Props:
- `play: boolean` — false renders the final drawn state statically (also the reduced-motion path).
- `tone: 'verified' | 'rejected'` — `verified` = green fill + check; `rejected` = `--neg` ring + a
  muted ✕, no green, no pop (a quiet mark).
- `size?: number` (default 28).
Reduced-motion (a `prefersReducedMotion` store, §3.5) → no spring/draw; render done-state instantly.

### 3.2 `src/lib/components/CountUp.svelte`
Animated numeric via `svelte/motion` `tweened` over `dur.slow` (360ms), ease-out
(`cubicOut`). Props `cents: number`, `currency = 'USD'`. Formats each frame with the **same**
`Intl.NumberFormat(... style:'currency')` call as `Money.svelte`; `font-variant-numeric:
tabular-nums` so width never reflows mid-count. Counts `0 → cents`. Reduced-motion → set to `cents`
immediately (no tween). `Money.svelte` is unchanged (static sibling; CountUp is the animated one).

### 3.3 Keyframes (append to `src/app.css`, inside/covered by the existing reduced-motion block)
- `@keyframes payout-glow` — `box-shadow` from `0 0 0 0 transparent` → `0 0 0 4px rgba(68,255,152,.30)`
  → back to transparent, one shot (`--dur-slow`). Applied via a `.payout-glow` class toggled on the row.
- `@keyframes reject-settle` — `translateX(0 → -5px → 3px → 0)`, one shot (`--dur-base`). `.reject-settle` class.
- Both are transform/opacity/box-shadow only; the existing `@media (prefers-reduced-motion: reduce)`
  global rule (app.css:36) already forces `animation-duration:.01ms`, so they self-neutralize.

### 3.4 Orchestration — `use:enhance` on the outcome forms
Convert these plain `method="POST"` forms to `use:enhance` so the row stays mounted to animate,
then refetch:
- `src/routes/console/+page.svelte`: `verify`, `reject`, `request_revision` forms.
- `src/routes/admin/payouts/+page.svelte`: `approve`, `reject` forms.

Per-row state via a rune keyed by answer id: `outcome: 'verifying' | 'rejecting' | 'revising' | null`
and a `pending` guard (same idiom as `VoteControl`). The enhance handler has two phases:

**Before-submit phase** (runs as the POST is dispatched, so the animation and the server round-trip
overlap):
1. On re-entry while `pending` → `cancel()` (no double-fire).
2. Set `pending = true` and the matching `outcome` — this mounts `VerifySeal` (+ `CountUp` for verify)
   and toggles the row class (`payout-glow` / `reject-settle`); the moment begins playing now.

**Result callback** (after the server responds):
3. **Hold first, refetch after** (the ordering that keeps the row mounted through the moment): `await`
   the remaining sequence time so the total reads ~700ms verify / ~260ms reject from step 2 (a
   promise-timeout the handler owns; **skipped entirely under reduced motion**).
4. *Then* `await update()` — runs `invalidateAll()`; the refetched data removes the row from the
   queue (status is no longer `submitted`/`under_review`) / dims it. Clear `pending`.

(If the action returned `fail()` — e.g. rate-limited or an RPC error — skip the hold, surface the
message, clear `pending`, and `update()`; no success animation plays.)

**Full verify timeline (~700ms):** seal draw + pop `0–360ms` → at ~60% (`~220ms`) the
"Intended payout" line swaps to `<CountUp>` (counts to the entered amount, `360ms`) + one
`payout-glow` pulse → settle. **Admin approve:** seal pop + glow only (`~400ms`), amount shown
statically via `Money` (unchanged at the gate). **Reject:** `reject-settle` + row opacity to
`--muted` over `dur.base`; **request_revision:** same settle in `--warn`. Dismissals are quicker
than the entrance (CLAUDE.md §2.3).

### 3.5 Reduced motion
`src/lib/motion.ts` gains a `prefersReducedMotion` readable store (matchMedia
`(prefers-reduced-motion: reduce)`, SSR-safe default `false`, updates on change). `VerifySeal`,
`CountUp`, and the orchestration read it to jump to final state (no spring/tween/hold). The CSS
keyframes are already neutralized globally. Final states (seal drawn, amount shown, row dimmed) are
always reached.

## 4. Surfaces & data
- Recipient row = the queue card in `console` (verify/reject/revision) and the pending card in
  `admin/payouts` (approve/reject).
- The amount = the value the author types into the existing `payout` input (verify) → already passed
  to `verify_answer` as `p_payout_amount_cents`. The animation reads the same submitted value for
  the count-up (from the form data) so it counts to exactly what was recorded; on the post-update
  refetch the static `Money` shows the persisted value.
- No new server fields; the actions and RPCs are untouched.

## 5. Testing
- **Vitest** `CountUp.test.ts`: tweens from 0 toward target (intermediate < target mid-flight,
  equals target at rest); reduced-motion (store mocked true) renders the final formatted value
  immediately; formatting matches `Money` (`$X.XX`).
- **Vitest** `VerifySeal.test.ts`: `play=false` (and reduced-motion) renders the done-state markup
  (full check, no pending dashoffset); `tone='rejected'` renders the ✕/`--neg`, never `--green`.
- **Vitest** wiring (`console` and/or `payouts`): the enhance callback sets the right `outcome`,
  guards re-entry while `pending`, and calls `update()`; reduced-motion path skips the hold.
- **Manual / Playwright (optional):** verify in the console → seal + count-up + glow; toggle OS
  reduced-motion → states jump, no motion. (Money-off: the label reads "Intended payout".)

## 6. Risks / accepted
- Converting forms to `use:enhance` changes them from full-reload to client-updated — strictly
  better UX; the no-JS fallback still submits (progressive enhancement) and just won't animate.
- The ~700ms hold briefly delays the row leaving the queue — intentional (the moment must read);
  bounded and skipped under reduced motion.
- `tweened`/`matchMedia` are client-only; components must guard SSR (store defaults false, tween
  set in `onMount`/effect) so SSR renders the final static state.
- No sound, no particles, no confetti, no sorting/RPC/DB changes (YAGNI + CLAUDE.md "Don't").
