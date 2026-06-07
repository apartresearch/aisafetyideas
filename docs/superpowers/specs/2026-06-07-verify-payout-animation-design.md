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
- `size?: number` (default 20 — fits the console header + admin table inline without bumping row height).
Reduced-motion (a `prefersReducedMotion` store, §3.5) → no spring/draw; render done-state instantly.

### 3.2 `src/lib/components/CountUp.svelte`
Animated numeric via `svelte/motion` `tweened` over `dur.slow` (360ms), ease-out
(`cubicOut`). Props `cents: number`, `currency = 'USD'`, `reduced?` (default = the store value,
injectable for tests). Formats each frame with `formatCents` (the shared helper). **Width is
reserved** by an `aria-hidden` sizer rendering the *final* formatted string under the
absolutely-positioned counting value — `tabular-nums` alone does not reserve space for digits/commas
not yet present, so the count would otherwise widen and shove the seal left. Counts `0 → cents`;
reduced → set to `cents` immediately. `Money.svelte` is unchanged (static sibling; CountUp animated).

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

**SUCCESS-GATED** (revised after the 6-lens plan review — the original "optimistic" mounting would
flash a fake "Verified · $X" on a failed/rate-limited verify, wrong for a money moment):

**Before-submit phase** (as the POST dispatches):
1. On re-entry while in-flight → `cancel()` (no double-fire).
2. `prepare(input)` captures the typed payout from `input.formData`.
3. `markPending()` — a **neutral** in-flight marker that hides the row's controls. **No green seal,
   no count-up** yet (nothing that implies success).

**Result callback** (after the server responds):
4. **Only if `result.type === 'success'`:** `showSucceeded()` mounts `VerifySeal` (+ `CountUp` for
   verify) and toggles `payout-glow` / settle; then hold the full sequence (~700ms verify / ~400ms
   admin approve / ~260ms reject/revision) so the moment reads — **skipped under reduced motion**.
5. `await update()` (`invalidateAll()`): verified/rejected rows leave the queue (status off the
   load filter); a **revision** row stays (`revision_requested` is still in the filter) and re-shows
   its controls with an updated badge — the amber settle reads as in-place feedback, not removal.
6. `finish()` clears the in-flight + visual state.

(On a `fail()` result — rate-limit / RPC error — `showSucceeded()` never runs and there's no hold:
just `update()` + `finish()`; the error surfaces via the page's `form` prop. **No success visual
ever appears for a verification the server rejected.**)

**Full verify timeline (~700ms):** seal draw + pop `0–360ms` → at ~60% (`~220ms`) the
"Intended payout" line swaps to `<CountUp>` (counts to the entered amount, `360ms`) + one
`payout-glow` pulse → settle. **Admin approve:** seal pop + glow only (`~400ms`), amount shown
statically via `Money` (unchanged at the gate). **Reject:** `reject-settle` + row opacity to
`--muted` over `dur.base`; **request_revision:** same settle in `--warn`. Dismissals are quicker
than the entrance (CLAUDE.md §2.3).

### 3.5 Reduced motion
`src/lib/motion.ts` gains a `prefersReducedMotion` readable store (matchMedia
`(prefers-reduced-motion: reduce)`, SSR-safe default `false`, updates on change). `VerifySeal` and
`CountUp` take a `reduced` **prop** that defaults to the store but is **injectable** — so vitest
drives both branches deterministically (jsdom has no real matchMedia). The orchestration reads the
store to skip the hold. CSS keyframes are neutralized globally. Final states (seal drawn, amount
shown, row dimmed) are always reached. *Accepted:* the page reads `reduced` once at init, so a
mid-session OS toggle won't retro-apply — negligible.

### 3.6 Test infrastructure (new — these don't exist yet)
Component render tests are the repo's first. `vite.config.ts` must add `test.conditions:['browser']`
(else `@testing-library/svelte` `render()` hits Svelte's SSR build and throws) and a `setupFiles`
that stubs `window.matchMedia` (else `svelte/motion` throws at *import* under jsdom). Without both,
every component test errors before asserting.

## 4. Surfaces & data
- Recipient row = the queue card in `console` (verify/reject/revision) and the pending card in
  `admin/payouts` (approve/reject).
- The amount = the value the author types into the existing `payout` input (verify) → already passed
  to `verify_answer` as `p_payout_amount_cents`. The animation reads the same submitted value for
  the count-up (from the form data) so it counts to exactly what was recorded; on the post-update
  refetch the static `Money` shows the persisted value.
- No new server fields; the actions and RPCs are untouched.

## 5. Testing
- **Vitest** `CountUp.test.ts`: `reduced:true` → final value immediately; `reduced:false` → the
  visible value starts at `$0.00` and animates to the target; an `aria-hidden` sizer always shows
  the final string (width reserve). Formatting via `formatCents`.
- **Vitest** `VerifySeal.test.ts`: `play=false` (and `reduced:true`) render the done-state (style
  contains `stroke-dashoffset: 0` — note jsdom's space after the colon); `tone='rejected'` → the
  ✕/`--neg`, never `--green`.
- **Vitest** `review-motion.test.ts`: cancel-if-pending (no `markPending`); **success** →
  `markPending → showSucceeded → hold → update → finish`; **failure** → `markPending → update →
  finish` (**no `showSucceeded`, no hold** — the money-honesty guarantee); reduced success skips
  the hold; `prepare` runs before `markPending`.
- **Vitest** `money.test.ts`: `formatCents` cases.
- **Manual (optional):** verify → seal+count-up+glow on success only; a rate-limited verify shows
  the error with no green flash; OS reduced-motion → states jump. (Money-off: "Intended payout".)

## 6. Risks / accepted
- Converting forms to `use:enhance` changes them from full-reload to client-updated — strictly
  better UX; the no-JS fallback still submits (progressive enhancement) and just won't animate.
- The ~700ms hold briefly delays the row leaving the queue — intentional (the moment must read);
  bounded and skipped under reduced motion.
- `tweened`/`matchMedia` are client-only; components must guard SSR (store defaults false, tween
  set in `onMount`/effect) so SSR renders the final static state.
- No sound, no particles, no confetti, no sorting/RPC/DB changes (YAGNI + CLAUDE.md "Don't").
