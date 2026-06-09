# Verify→Payout Signature Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax. No cloud/DB/RPC changes - presentational + an enhance conversion. Constraints: never edit CLAUDE.md/docs//.claude//src_legacy_v0/; never `git add .`/`git add -A` (explicit paths only).

**Goal:** Play CLAUDE.md's verify→payout signature moment - a seal draws its check + fills `--green` with a small pop, then the recorded payout counts up with one green glow - **only after the server confirms** the verify; a lighter seal on admin approve; a restrained settle on reject (dim) / revision (amber); everything jumps to final under `prefers-reduced-motion`.

**Architecture:** Two presentational primitives (`VerifySeal`, `CountUp`, each with an injectable `reduced` prop), a pure formatter + a reduced-motion store, two CSS keyframes, and a framework-agnostic `use:enhance` orchestration helper (`makeOutcomeEnhancer`) that shows the success visual **in the result callback on success only**. Wired into the console + admin/payouts review forms. Spec: `docs/superpowers/specs/2026-06-07-verify-payout-animation-design.md`.

**Tech Stack:** Svelte 5 runes, `svelte/motion` `tweened` + `svelte/easing` `cubicOut`, Tailwind v4, vitest + `@testing-library/svelte` (jsdom). **Component render tests require config not yet present** - Task 1 adds `resolve.conditions:['browser']` + a `matchMedia` setup stub (without which `svelte/motion` throws at import under jsdom). The `reduced` prop (not the store) is what tests drive, so both motion branches are deterministically testable.

---

## Key decisions
- **Success-gated visual (the money-honesty fix):** the green seal/CountUp/glow mount **only when `result.type==='success'`**, never optimistically - a rate-limited/failed verify must never flash "Verified · $X". The before-submit phase only marks the row in-flight (hides controls, no green).
- **`reduced` is an injectable prop** on `CountUp`/`VerifySeal` (default = `get(prefersReducedMotion)`), so vitest drives both branches without depending on jsdom matchMedia.
- **DRY money:** `formatCents` in `$lib/money.ts`, used by `Money` + `CountUp`.
- **Orchestration extracted** to `$lib/review-motion.ts` for unit testing the phase logic.
- **Seal/glow are CSS-driven**; the global reduced-motion block neutralizes them. On the admin **table**, animate cells (`<td>`)/opacity - never `transform`/`box-shadow` on `<tr>` (unreliable).

## File structure

| File | Responsibility |
|---|---|
| `vite.config.ts` (modify) | `resolve.conditions:['browser']` + `setupFiles` for component tests |
| `vitest.setup.ts` (new) | stub `window.matchMedia` (else `svelte/motion` throws at import) |
| `src/lib/money.ts` (new) | `formatCents(cents, currency)` pure formatter |
| `src/lib/motion.ts` (modify) | add `prefersReducedMotion` readable store |
| `src/lib/components/Money.svelte` (modify) | use `formatCents` (no behavior change) |
| `src/lib/components/CountUp.svelte` (new) | tweened 0→cents, width-reserved, `reduced` prop |
| `src/lib/components/VerifySeal.svelte` (new) | SVG check-draw + green-pop / reject ✕, `reduced` prop |
| `src/app.css` (modify) | `payout-glow`, `reject-settle` keyframes + `row-dim`/`row-warn` |
| `src/lib/review-motion.ts` (new) | `makeOutcomeEnhancer` + `HOLD_MS` (success-gated) |
| `src/routes/console/+page.svelte` (modify) | verify (full) / reject / request_revision |
| `src/routes/admin/payouts/+page.svelte` (modify) | approve (lighter) / reject |
| `*.test.ts` | money, CountUp, VerifySeal, review-motion |

---

## Task 1: Test config + foundation (`formatCents`, reduced-motion store)

**Files:** Modify `vite.config.ts`; create `vitest.setup.ts`, `src/lib/money.ts`, `src/lib/money.test.ts`; modify `src/lib/motion.ts`, `src/lib/components/Money.svelte`.

- [ ] **Step 1: Enable component render tests.** Replace `vite.config.ts` with:

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // resolve Svelte's browser build so @testing-library/svelte render()/mount() works under jsdom
    conditions: ['browser'],
    include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.{test,spec}.{js,ts}']
  }
});
```

Create `vitest.setup.ts` (without this, `svelte/motion` constructs a `MediaQuery` at import and throws `window.matchMedia is not a function`):

```ts
// jsdom has no matchMedia; svelte/motion touches it at module load. Stub a no-op (reduced = false).
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  // @ts-expect-error – minimal stub for tests
  window.matchMedia = (query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent() { return false; }
  });
}
```

- [ ] **Step 2: Confirm the config works** - `npx vitest run` → the existing suites still pass (the `conditions`/setup change must not break route-logic tests). Expected: all current tests green.

- [ ] **Step 3: Write the failing test** `src/lib/money.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatCents } from './money';

describe('formatCents', () => {
  it('formats cents as USD currency', () => {
    expect(formatCents(3712)).toBe('$37.12');
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(100000)).toBe('$1,000.00');
  });
  it('renders an em-dash for null/undefined', () => {
    expect(formatCents(null)).toBe('-');
    expect(formatCents(undefined)).toBe('-');
  });
  it('honors a currency argument', () => {
    expect(formatCents(500, 'EUR')).toBe('€5.00');
  });
});
```

- [ ] **Step 4: Run** `npx vitest run src/lib/money.test.ts` → FAIL (module missing).

- [ ] **Step 5: Implement** `src/lib/money.ts`:

```ts
/** Format integer cents as a localized currency string; null/undefined → em-dash. */
export function formatCents(cents: number | null | undefined, currency = 'USD'): string {
  return cents == null
    ? '-'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}
```

- [ ] **Step 6: Refactor `Money.svelte`** (no behavior change):

```svelte
<script lang="ts">
  import { formatCents } from '$lib/money';
  let { cents, currency = 'USD' }: { cents: number | null | undefined; currency?: string } = $props();
  const fmt = $derived(formatCents(cents, currency));
</script>
<span style="font-variant-numeric: tabular-nums">{fmt}</span>
```

- [ ] **Step 7: Add the reduced-motion store** to `src/lib/motion.ts` (append):

```ts
import { readable } from 'svelte/store';

/** True when the user asked for reduced motion. SSR-safe default false; updates on change. */
export const prefersReducedMotion = readable(false, (set) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  set(mq.matches);
  const on = () => set(mq.matches);
  mq.addEventListener('change', on);
  return () => mq.removeEventListener('change', on);
});
```

- [ ] **Step 8: Run** `npx vitest run src/lib/money.test.ts` → PASS; `npm run check` → 0 errors.
- [ ] **Step 9: Commit** `git add vite.config.ts vitest.setup.ts src/lib/money.ts src/lib/money.test.ts src/lib/motion.ts src/lib/components/Money.svelte && git commit -m "test+feat: enable component render tests; formatCents + prefersReducedMotion; Money uses formatCents"`

---

## Task 2: `CountUp.svelte` (width-reserved, reduced-prop)

**Files:** Create `src/lib/components/CountUp.svelte`, `src/lib/components/CountUp.test.ts`.

- [ ] **Step 1: Write the failing test** `src/lib/components/CountUp.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import CountUp from './CountUp.svelte';

describe('CountUp', () => {
  it('reduced=true renders the final amount immediately (no count)', () => {
    const { container } = render(CountUp, { props: { cents: 3712, reduced: true } });
    expect(container.textContent).toContain('$37.12');
  });
  it('reduced=false starts below the target and animates up to it', async () => {
    const { container } = render(CountUp, { props: { cents: 3712, reduced: false } });
    // the visible (non-sizer) value starts at $0.00 and lands on $37.12
    const value = () => container.querySelector('[data-countup-value]')?.textContent ?? '';
    expect(value()).toBe('$0.00');
    await waitFor(() => expect(value()).toBe('$37.12'), { timeout: 1500 });
  });
  it('reserves the final width with an aria-hidden sizer to avoid reflow', () => {
    const { container } = render(CountUp, { props: { cents: 100000, reduced: true } });
    const sizer = container.querySelector('[aria-hidden="true"]');
    expect(sizer?.textContent).toBe('$1,000.00');   // sizer always shows the FINAL string
  });
});
```

- [ ] **Step 2: Run** → FAIL (module missing).

- [ ] **Step 3: Implement** `src/lib/components/CountUp.svelte`:

```svelte
<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { get } from 'svelte/store';
  import { dur, prefersReducedMotion } from '$lib/motion';
  import { formatCents } from '$lib/money';

  let { cents, currency = 'USD', reduced = get(prefersReducedMotion) }: {
    cents: number; currency?: string; reduced?: boolean;
  } = $props();

  const value = tweened(reduced ? cents : 0, {
    duration: reduced ? 0 : dur.slow * 1000,
    easing: cubicOut
  });
  $effect(() => { value.set(cents); });
  const display = $derived(formatCents(Math.round($value), currency));
  const finalStr = $derived(formatCents(cents, currency));
</script>
<!-- relative box: an aria-hidden sizer reserves the FINAL width so the counting value never reflows -->
<span style="position:relative; display:inline-block; font-variant-numeric:tabular-nums">
  <span aria-hidden="true" style="visibility:hidden">{finalStr}</span>
  <span data-countup-value style="position:absolute; left:0; top:0">{display}</span>
</span>
```

- [ ] **Step 4: Run** → PASS (`reduced:true` immediate; `reduced:false` animates 0→target; sizer shows final). `npm run check` → 0 errors.
- [ ] **Step 5: Commit** `git add src/lib/components/CountUp.svelte src/lib/components/CountUp.test.ts && git commit -m "feat(motion): CountUp - width-reserved tweened amount, reduced prop"`

---

## Task 3: `VerifySeal.svelte` (reduced-prop)

**Files:** Create `src/lib/components/VerifySeal.svelte`, `src/lib/components/VerifySeal.test.ts`.

- [ ] **Step 1: Write the failing test** `src/lib/components/VerifySeal.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import VerifySeal from './VerifySeal.svelte';

describe('VerifySeal', () => {
  it('renders the check fully drawn in the static (play=false) state', () => {
    const { container } = render(VerifySeal, { props: { play: false, tone: 'verified' } });
    // jsdom CSSOM serializes inline style with a space after the colon
    expect(container.querySelector('path')?.getAttribute('style')).toContain('stroke-dashoffset: 0');
    expect(container.querySelector('circle')?.getAttribute('fill')).toBe('var(--green)');
  });
  it('reduced=true also renders drawn immediately even with play=true', () => {
    const { container } = render(VerifySeal, { props: { play: true, reduced: true, tone: 'verified' } });
    expect(container.querySelector('path')?.getAttribute('style')).toContain('stroke-dashoffset: 0');
  });
  it('renders a neg ✕ for tone=rejected, never green', () => {
    const { container } = render(VerifySeal, { props: { play: false, tone: 'rejected' } });
    expect(container.querySelector('circle')?.getAttribute('fill')).toBe('none');
    expect(container.innerHTML).not.toContain('var(--green)');
    expect(container.innerHTML).toContain('var(--neg)');
  });
});
```

- [ ] **Step 2: Run** → FAIL (module missing).

- [ ] **Step 3: Implement** `src/lib/components/VerifySeal.svelte`:

```svelte
<script lang="ts">
  import { get } from 'svelte/store';
  import { prefersReducedMotion } from '$lib/motion';

  let { play = false, tone = 'verified', size = 20, reduced = get(prefersReducedMotion) }: {
    play?: boolean; tone?: 'verified' | 'rejected'; size?: number; reduced?: boolean;
  } = $props();

  const LEN = 20; // approx length of the check polyline for the draw
  // drawn immediately when static or reduced; otherwise start undrawn then flip next frame to transition
  let drawn = $state(!play || reduced);
  $effect(() => {
    if (play && !reduced && typeof requestAnimationFrame === 'function') {
      drawn = false;
      requestAnimationFrame(() => { drawn = true; });
    } else {
      drawn = true;
    }
  });
</script>

<svg width={size} height={size} viewBox="0 0 24 24"
     class:pop={play && !reduced && tone === 'verified'}
     aria-hidden="true" style="display:inline-block; vertical-align:middle">
  {#if tone === 'verified'}
    <circle cx="12" cy="12" r="11" fill="var(--green)" />
    <path d="M7 12.5l3.3 3.3L17 9" fill="none" stroke="var(--ink)" stroke-width="2.2"
          stroke-linecap="round" stroke-linejoin="round"
          style="stroke-dasharray:{LEN}; stroke-dashoffset:{drawn ? 0 : LEN};
                 transition:stroke-dashoffset var(--dur-base) var(--ease-snappy)" />
  {:else}
    <circle cx="12" cy="12" r="11" fill="none" stroke="var(--neg)" stroke-width="2" />
    <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" fill="none" stroke="var(--neg)" stroke-width="2.2"
          stroke-linecap="round" style="stroke-dashoffset:0" />
  {/if}
</svg>

<style>
  .pop { transform-origin: center; animation: seal-pop var(--dur-base) var(--ease-snappy); }
  @keyframes seal-pop { 0% { transform: scale(1); } 45% { transform: scale(1.12); } 100% { transform: scale(1); } }
</style>
```

- [ ] **Step 4: Run** → PASS; `npm run check` → 0 errors.
- [ ] **Step 5: Commit** `git add src/lib/components/VerifySeal.svelte src/lib/components/VerifySeal.test.ts && git commit -m "feat(motion): VerifySeal - check-draw + green pop / reject ✕, reduced prop"`

---

## Task 4: Keyframes + success-gated orchestration helper

**Files:** Modify `src/app.css`; create `src/lib/review-motion.ts`, `src/lib/review-motion.test.ts`.

- [ ] **Step 1: Add keyframes** to `src/app.css` (append; the global reduced-motion block already neutralizes animations):

```css
/* ── verify→payout signature motion (CLAUDE.md §5) ── */
.payout-glow { animation: payout-glow var(--dur-slow) var(--ease-out-soft); }
@keyframes payout-glow {
  0%   { box-shadow: 0 0 0 0 rgba(68, 255, 152, 0); }
  40%  { box-shadow: 0 0 0 4px rgba(68, 255, 152, .30); }
  100% { box-shadow: 0 0 0 0 rgba(68, 255, 152, 0); }
}
.reject-settle { animation: reject-settle var(--dur-base) var(--ease-snappy); }
@keyframes reject-settle {
  0% { transform: translateX(0); } 35% { transform: translateX(-5px); }
  70% { transform: translateX(3px); } 100% { transform: translateX(0); }
}
.row-dim  { opacity: .5; transition: opacity var(--dur-base) var(--ease-snappy); }            /* reject → muted */
.row-warn { box-shadow: inset 3px 0 0 0 var(--warn); transition: box-shadow var(--dur-base); } /* revision → amber */
```

(`--ease-out-soft`, `--ease-snappy`, `--dur-*`, `--warn` all already exist in app.css `:root`.)

- [ ] **Step 2: Write the failing test** `src/lib/review-motion.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { makeOutcomeEnhancer, HOLD_MS } from './review-motion';

function harness(opts: Partial<Parameters<typeof makeOutcomeEnhancer>[0]> = {}) {
  const calls: string[] = [];
  const hold = vi.fn(() => { calls.push('hold'); return Promise.resolve(); });
  const enhancer = makeOutcomeEnhancer({
    kind: 'verifying', reduced: false,
    isPending: () => false,
    markPending: () => calls.push('markPending'),
    showSucceeded: () => calls.push('showSucceeded'),
    finish: () => calls.push('finish'),
    hold,
    ...opts
  });
  return { enhancer, calls, hold };
}

describe('makeOutcomeEnhancer', () => {
  it('cancels (no markPending) when already pending', () => {
    const cancel = vi.fn();
    const { enhancer, calls } = harness({ isPending: () => true });
    expect(enhancer({ cancel } as any)).toBeUndefined();
    expect(cancel).toHaveBeenCalled();
    expect(calls).toEqual([]);
  });
  it('SUCCESS: markPending (before) → showSucceeded → hold → update → finish', async () => {
    const { enhancer, calls, hold } = harness();
    const update = vi.fn(() => { calls.push('update'); return Promise.resolve(); });
    await enhancer({ cancel: vi.fn() } as any)!({ result: { type: 'success' }, update } as any);
    expect(hold).toHaveBeenCalledWith(HOLD_MS.verifying);
    expect(calls).toEqual(['markPending', 'showSucceeded', 'hold', 'update', 'finish']);
  });
  it('FAILURE: never shows the success visual, no hold - just update + finish', async () => {
    const { enhancer, calls, hold } = harness();
    const update = vi.fn(() => { calls.push('update'); return Promise.resolve(); });
    await enhancer({ cancel: vi.fn() } as any)!({ result: { type: 'failure' }, update } as any);
    expect(hold).not.toHaveBeenCalled();
    expect(calls).toEqual(['markPending', 'update', 'finish']);   // NO showSucceeded
  });
  it('reduced motion: success shows the visual but skips the hold', async () => {
    const { enhancer, calls, hold } = harness({ reduced: true });
    const update = vi.fn(() => { calls.push('update'); return Promise.resolve(); });
    await enhancer({ cancel: vi.fn() } as any)!({ result: { type: 'success' }, update } as any);
    expect(hold).not.toHaveBeenCalled();
    expect(calls).toEqual(['markPending', 'showSucceeded', 'update', 'finish']);
  });
  it('runs prepare(input) before markPending', () => {
    const calls: string[] = [];
    const enhancer = makeOutcomeEnhancer({
      kind: 'verifying', reduced: false, isPending: () => false,
      prepare: (i: any) => calls.push('prepare:' + i.formData.get('payout')),
      markPending: () => calls.push('markPending'),
      showSucceeded: () => {}, finish: () => {}, hold: () => Promise.resolve()
    });
    enhancer({ cancel: vi.fn(), formData: new Map([['payout', '5']]) } as any);
    expect(calls).toEqual(['prepare:5', 'markPending']);
  });
});
```

- [ ] **Step 3: Run** → FAIL (module missing).

- [ ] **Step 4: Implement** `src/lib/review-motion.ts`:

```ts
import type { SubmitFunction } from '@sveltejs/kit';

export type OutcomeKind = 'verifying' | 'approving' | 'rejecting' | 'revising';

/** Sequence durations (ms): full verify reads ~700ms; the lighter admin approve ~400ms;
 *  dismissals quicker (CLAUDE.md §2.3). The hold runs AFTER the success visual mounts. */
export const HOLD_MS: Record<OutcomeKind, number> = {
  verifying: 700, approving: 400, rejecting: 260, revising: 260
};

/**
 * Build a `use:enhance` SubmitFunction that plays the review-outcome moment, then refetches.
 * SUCCESS-GATED: the before-submit phase only marks the row in-flight (markPending - NO green seal,
 * so a rejected/failed request never flashes a fake "Verified"). The success visual (showSucceeded)
 * mounts ONLY in the result callback when result.type === 'success', then holds the full sequence
 * (skipped under reduced motion), then update() refetches, then finish().
 * On a fail() result: no success visual, no hold - just update() + finish() (the form's
 * error message surfaces via the page's `form` prop after invalidateAll).
 */
export function makeOutcomeEnhancer(opts: {
  kind: OutcomeKind;
  reduced: boolean;
  isPending: () => boolean;
  markPending: () => void;            // neutral in-flight marker (hide controls); NO success visual
  showSucceeded: () => void;          // mount seal/CountUp/glow or settle (success only)
  finish: () => void;                 // clear in-flight + visual
  prepare?: (input: Parameters<SubmitFunction>[0]) => void;  // e.g. capture the typed payout
  hold?: (ms: number) => Promise<void>;
}): SubmitFunction {
  const hold = opts.hold ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  return (input) => {
    if (opts.isPending()) {
      input.cancel();
      return;
    }
    opts.prepare?.(input);
    opts.markPending();
    return async ({ result, update }) => {
      if (result.type === 'success') {
        opts.showSucceeded();
        if (!opts.reduced) await hold(HOLD_MS[opts.kind]);
      }
      await update();
      opts.finish();
    };
  };
}
```

- [ ] **Step 5: Run** → PASS; `npm run check` → 0 errors.
- [ ] **Step 6: Commit** `git add src/app.css src/lib/review-motion.ts src/lib/review-motion.test.ts && git commit -m "feat(motion): keyframes + success-gated makeOutcomeEnhancer"`

---

## Task 5: Wire the console review queue

**Files:** Modify `src/routes/console/+page.svelte`. Two-flag per-row state: `inflight` (neutral, set in `markPending`) hides controls during the round-trip; `shown` (set in `showSucceeded`) drives the visual on success only. The create form stays a plain POST.

> **Behavior note (corrected):** after `update()`, a **verified** or **rejected** row leaves the
> queue (those statuses aren't in the load filter `submitted/under_review/revision_requested`), so
> the moment is its send-off. A **request_revision** row **stays** (`revision_requested` is in the
> filter) and re-shows its controls with a "Revision requested" badge - the amber settle reads as
> in-place feedback, not a removal.

- [ ] **Step 1: Replace the `<script>` block** in `src/routes/console/+page.svelte`:

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import { get } from 'svelte/store';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import Markdown from '$lib/components/Markdown.svelte';
  import VerifySeal from '$lib/components/VerifySeal.svelte';
  import CountUp from '$lib/components/CountUp.svelte';
  import { makeOutcomeEnhancer, type OutcomeKind } from '$lib/review-motion';
  import { prefersReducedMotion } from '$lib/motion';

  let { data, form } = $props();
  const reduced = get(prefersReducedMotion);

  let inflight = $state<Record<string, boolean>>({});                 // round-trip marker (hide controls)
  let shown = $state<Record<string, OutcomeKind | undefined>>({});    // success visual only
  let verifiedCents = $state<Record<string, number>>({});
  let announce = $state('');                                          // aria-live text

  function enhancer(id: string, kind: OutcomeKind, label: string) {
    return makeOutcomeEnhancer({
      kind, reduced,
      isPending: () => inflight[id] === true,
      prepare: kind === 'verifying'
        ? (input) => {
            const dollars = Number(input.formData.get('payout'));
            if (Number.isFinite(dollars)) verifiedCents = { ...verifiedCents, [id]: Math.round(dollars * 100) };
          }
        : undefined,
      markPending: () => { inflight = { ...inflight, [id]: true }; },
      showSucceeded: () => { shown = { ...shown, [id]: kind }; announce = label; },
      finish: () => {
        const i = { ...inflight }; delete i[id]; inflight = i;
        const s = { ...shown }; delete s[id]; shown = s;
      }
    });
  }
</script>
```

- [ ] **Step 2: Replace the review-queue `{#each}` block** with:

```svelte
  <div class="mb-8 flex flex-col gap-3" aria-live="polite">
    <span class="sr-only">{announce}</span>
    {#each data.queue as a (a.id)}
      <div class="rounded-2xl border p-5"
           class:payout-glow={shown[a.id] === 'verifying'}
           class:reject-settle={shown[a.id] === 'rejecting' || shown[a.id] === 'revising'}
           class:row-dim={shown[a.id] === 'rejecting'}
           class:row-warn={shown[a.id] === 'revising'}
           style="border-color:var(--line); background:var(--surface)">
        <div class="mb-1 flex items-center justify-between gap-2">
          <div>
            <a href="/ideas/{a.idea_id}" class="font-bold" style="color:var(--ink)">{a.title}</a>
            <span class="ml-2 text-xs" style="color:var(--faint)">on “{a.ideas?.title}” · by {a.submitter?.display_name ?? a.submitter?.handle}</span>
          </div>
          {#if shown[a.id] === 'verifying'}
            <span class="flex items-center gap-1.5 text-sm font-medium whitespace-nowrap" style="color:var(--green-deep)">
              <VerifySeal play tone="verified" {reduced} /> Verified · <CountUp cents={verifiedCents[a.id] ?? 0} {reduced} />
            </span>
          {:else}
            <StatusBadge status={a.status} />
          {/if}
        </div>
        <Markdown html={a.explanation_html} class="mb-2" />
        {#if a.answer_artifacts?.length}
          <ul class="mb-3 flex flex-col gap-1 text-sm">
            {#each a.answer_artifacts as art (art.id)}
              <li><a href={art.url} target="_blank" rel="noopener" style="color:var(--green-deep)">{art.label ?? art.kind} ↗</a></li>
            {/each}
          </ul>
        {/if}

        {#if !inflight[a.id]}
          <form method="POST" action="?/verify" class="flex flex-wrap items-end gap-2 border-t pt-3"
                style="border-color:var(--line)" use:enhance={enhancer(a.id, 'verifying', 'Answer verified.')}>
            <input type="hidden" name="answer_id" value={a.id} />
            <label class="text-xs" style="color:var(--faint)">Intended payout ($)
              <input name="payout" type="number" min="0.01" step="0.01" placeholder="0.00" required
                     class="block w-28 rounded-xl border px-2 py-1" style="border-color:var(--line)" />
            </label>
            {#if a.ideas?.type === 'hypothesis'}
              <label class="text-xs" style="color:var(--faint)">Resolution
                <select name="resolution" class="block rounded-xl border px-2 py-1" style="border-color:var(--line)">
                  <option value="yes">Yes</option><option value="no">No</option><option value="ambiguous">Ambiguous</option>
                </select>
              </label>
            {/if}
            <input name="note" placeholder="Note (optional)" class="flex-1 rounded-xl border px-2 py-1" style="border-color:var(--line)" />
            <button class="rounded-xl px-3 py-1 text-sm font-medium" style="background:var(--ink); color:#fff">Verify</button>
          </form>

          <div class="mt-2 flex gap-4">
            <form method="POST" action="?/request_revision" class="flex flex-1 gap-2"
                  use:enhance={enhancer(a.id, 'revising', 'Revision requested.')}>
              <input type="hidden" name="answer_id" value={a.id} />
              <input name="note" placeholder="What to revise" class="flex-1 rounded-xl border px-2 py-1 text-sm" style="border-color:var(--line)" />
              <button class="text-sm" style="color:var(--warn)">Request revision</button>
            </form>
            <form method="POST" action="?/reject" use:enhance={enhancer(a.id, 'rejecting', 'Answer rejected.')}>
              <input type="hidden" name="answer_id" value={a.id} />
              <button class="text-sm" style="color:var(--neg)">Reject</button>
            </form>
          </div>
        {/if}
      </div>
    {/each}
  </div>
```

(If `.sr-only` isn't already a global utility, add it to `app.css`: `.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}`.)

- [ ] **Step 3: Verify** `npm run check` → 0 errors; `npm run build` → succeeds; `npx vitest run` → all green.
- [ ] **Step 4: Manual smoke** (`npm run dev`): expert sign-in isn't headless-feasible - confirm the route compiles/renders (curl returns 200 or the auth redirect) and rely on the unit suites for behavior. Note the observation.
- [ ] **Step 5: Commit** `git add src/routes/console/+page.svelte src/app.css && git commit -m "feat(console): success-gated verify moment + reject(dim)/revision(amber) settle"`

---

## Task 6: Wire the admin/payouts gate (lighter seal, table-safe)

**Files:** Modify `src/routes/admin/payouts/+page.svelte`. Approve = `approving` kind (~400ms seal pop + glow, **no count-up** - amount unchanged). Reject = dim only. **No `transform`/`box-shadow` on `<tr>`** - glow goes on the action `<td>`, reject uses `row-dim` (opacity, which is reliable on rows).

- [ ] **Step 1: Replace the `<script>`**:

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import { get } from 'svelte/store';
  import Money from '$lib/components/Money.svelte';
  import VerifySeal from '$lib/components/VerifySeal.svelte';
  import { makeOutcomeEnhancer, type OutcomeKind } from '$lib/review-motion';
  import { prefersReducedMotion } from '$lib/motion';

  let { data, form } = $props();
  const reduced = get(prefersReducedMotion);
  let inflight = $state<Record<string, boolean>>({});
  let shown = $state<Record<string, OutcomeKind | undefined>>({});
  let announce = $state('');

  function enhancer(id: string, kind: OutcomeKind, label: string) {
    return makeOutcomeEnhancer({
      kind, reduced,
      isPending: () => inflight[id] === true,
      markPending: () => { inflight = { ...inflight, [id]: true }; },
      showSucceeded: () => { shown = { ...shown, [id]: kind }; announce = label; },
      finish: () => {
        const i = { ...inflight }; delete i[id]; inflight = i;
        const s = { ...shown }; delete s[id]; shown = s;
      }
    });
  }
</script>
```

- [ ] **Step 2: Replace the `<tbody>`** (and add an aria-live region just before the `<table>`):

```svelte
  <span class="sr-only" aria-live="polite">{announce}</span>
  <table class="w-full text-sm">
    <thead><tr style="color:var(--faint)">
      <th class="text-left">Answer</th><th class="text-left">Idea</th><th class="text-left">Submitter</th>
      <th class="text-right">Intended</th><th></th>
    </tr></thead>
    <tbody>
      {#each data.pending as a (a.id)}
        <tr style="border-top:1px solid var(--line)" class:row-dim={shown[a.id] === 'rejecting'}>
          <td class="py-2" style="color:var(--ink)"><a href="/ideas/{a.idea_id}" style="color:var(--green-deep)">{a.title}</a></td>
          <td style="color:var(--muted)">{a.ideas?.title}</td>
          <td style="color:var(--muted)">{a.submitter?.display_name ?? a.submitter?.handle}</td>
          <td class="text-right" style="color:var(--ink)"><Money cents={a.payout_amount_cents} currency={a.payout_currency} /></td>
          <td class="py-2 text-right" class:payout-glow={shown[a.id] === 'approving'}>
            {#if shown[a.id] === 'approving'}
              <span class="inline-flex items-center gap-1 text-sm font-medium" style="color:var(--green-deep)">
                <VerifySeal play tone="verified" {reduced} /> Approved
              </span>
            {:else if !inflight[a.id]}
              <form method="POST" action="?/approve" class="inline" use:enhance={enhancer(a.id, 'approving', 'Payout approved.')}>
                <input type="hidden" name="answer_id" value={a.id} />
                <button class="mr-3" style="color:var(--green-deep)">Approve</button>
              </form>
              <form method="POST" action="?/reject" class="inline" use:enhance={enhancer(a.id, 'rejecting', 'Payout rejected.')}>
                <input type="hidden" name="answer_id" value={a.id} />
                <button style="color:var(--neg)">Reject</button>
              </form>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
```

- [ ] **Step 3: Verify** `npm run check` → 0 errors; `npm run build` → succeeds; `npx vitest run` → all green.
- [ ] **Step 4: Commit** `git add src/routes/admin/payouts/+page.svelte && git commit -m "feat(payouts): lighter approve seal (table-safe glow) + reject dim"`

---

## Task 7: Final verification
- [ ] `npx vitest run` (whole repo) green; `npm run check` 0 errors; `npm run build` succeeds; `supabase test db` unchanged-green (no SQL touched).
- [ ] Manual (`npm run dev`, if expert/admin sign-in is feasible): verify plays seal+count-up+glow only on success; a rate-limited/failed verify shows the error with **no** green flash; OS reduced-motion ON → states jump. Otherwise note and rely on the unit suites.
- [ ] Dispatch the final holistic review; finish the branch (PR).

## Done-when
- `formatCents`, `prefersReducedMotion`, `CountUp` (width-reserved, reduced-prop), `VerifySeal` (reduced-prop), `makeOutcomeEnhancer` (success-gated) all unit-tested green; `Money` refactored, no behavior change; component render tests run (vite browser condition + matchMedia stub).
- Console verify shows the full moment **only on success**; admin approve the lighter ~400ms seal; reject dims, revision shows the amber settle (and stays in-queue). A `fail()` shows no success visual.
- Everything jumps to final under reduced motion (driven by the `reduced` prop, unit-tested both ways); an aria-live region announces each outcome.
- No RPC/DB/cloud changes; `npm run check`/`vitest`/`build`/`supabase test db` all green.
