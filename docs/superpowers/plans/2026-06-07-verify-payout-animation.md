# Verify→Payout Signature Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax. No cloud/DB/RPC changes — this is presentational + an enhance conversion. Constraints: never edit CLAUDE.md/docs//.claude//src_legacy_v0/; never `git add .`/`git add -A` (explicit paths only).

**Goal:** Play CLAUDE.md's verify→payout signature moment — a seal draws its check + fills `--green` with a small pop, then the recorded payout counts up with one green glow — on console verify; a lighter seal on admin approve; a restrained settle+dim on reject/revision; everything jumps to final under `prefers-reduced-motion`.

**Architecture:** Two presentational primitives (`VerifySeal`, `CountUp`), a pure formatter + a reduced-motion store, two CSS keyframes, and a framework-agnostic `use:enhance` orchestration helper (`makeOutcomeEnhancer`) wired into the console + admin/payouts review forms (converting them from full-reload to animate-then-refetch). Spec: `docs/superpowers/specs/2026-06-07-verify-payout-animation-design.md`.

**Tech Stack:** Svelte 5 runes, `svelte/motion` `tweened` + `svelte/easing` `cubicOut`, Tailwind v4, vitest + `@testing-library/svelte` (jsdom — note: jsdom has no `matchMedia`, so the reduced-motion store defaults to `false` in tests, deterministically).

---

## Key decisions
- **DRY the money format:** extract `formatCents` to `$lib/money.ts`; `Money.svelte` and `CountUp.svelte` both use it → one deterministic unit to test.
- **Reduced motion is a store** (`prefersReducedMotion`) read once at component init (preference rarely flips mid-session); SSR-safe default `false`.
- **Orchestration is extracted** to `$lib/review-motion.ts` (`makeOutcomeEnhancer`) so the two-phase logic (cancel-if-pending → begin → hold-then-update, `fail()` skips the hold) is unit-tested without mounting a page.
- **Seal is CSS-driven** (stroke-dashoffset transition + a `seal-pop` keyframe), not a JS spring — simpler, and the global reduced-motion block already neutralizes it.

## File structure

| File | Responsibility |
|---|---|
| `src/lib/money.ts` (new) | `formatCents(cents, currency)` pure formatter |
| `src/lib/motion.ts` (modify) | add `prefersReducedMotion` readable store |
| `src/lib/components/Money.svelte` (modify) | use `formatCents` (no behavior change) |
| `src/lib/components/CountUp.svelte` (new) | tweened 0→cents animated amount |
| `src/lib/components/VerifySeal.svelte` (new) | SVG check-draw + green-pop / reject ✕ |
| `src/app.css` (modify) | `@keyframes payout-glow`, `reject-settle` + classes |
| `src/lib/review-motion.ts` (new) | `makeOutcomeEnhancer` + `HOLD_MS` |
| `src/routes/console/+page.svelte` (modify) | wire verify (full) / reject / request_revision |
| `src/routes/admin/payouts/+page.svelte` (modify) | wire approve (lighter) / reject |
| `*.test.ts` | vitest for money, CountUp, VerifySeal, review-motion |

---

## Task 1: Foundation — `formatCents`, reduced-motion store

**Files:** Create `src/lib/money.ts`, `src/lib/money.test.ts`; modify `src/lib/motion.ts`, `src/lib/components/Money.svelte`.

- [ ] **Step 1: Write the failing test** `src/lib/money.test.ts`:

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
    expect(formatCents(null)).toBe('—');
    expect(formatCents(undefined)).toBe('—');
  });
  it('honors a currency argument', () => {
    expect(formatCents(500, 'EUR')).toBe('€5.00');
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/money.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** `src/lib/money.ts`:

```ts
/** Format integer cents as a localized currency string; null/undefined → em-dash. */
export function formatCents(cents: number | null | undefined, currency = 'USD'): string {
  return cents == null
    ? '—'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}
```

- [ ] **Step 4: Refactor `Money.svelte`** to use it (no behavior change):

```svelte
<script lang="ts">
  import { formatCents } from '$lib/money';
  let { cents, currency = 'USD' }: { cents: number | null | undefined; currency?: string } = $props();
  const fmt = $derived(formatCents(cents, currency));
</script>
<span style="font-variant-numeric: tabular-nums">{fmt}</span>
```

- [ ] **Step 5: Add the reduced-motion store** to `src/lib/motion.ts` (append):

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

- [ ] **Step 6: Run** `npx vitest run src/lib/money.test.ts` → PASS; `npm run check` → 0 errors.
- [ ] **Step 7: Commit** `git add src/lib/money.ts src/lib/money.test.ts src/lib/motion.ts src/lib/components/Money.svelte && git commit -m "feat(motion): formatCents helper + prefersReducedMotion store; Money uses formatCents"`

---

## Task 2: `CountUp.svelte`

**Files:** Create `src/lib/components/CountUp.svelte`, `src/lib/components/CountUp.test.ts`.

- [ ] **Step 1: Write the failing test** `src/lib/components/CountUp.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import CountUp from './CountUp.svelte';

describe('CountUp', () => {
  it('eventually displays the formatted target amount', async () => {
    const { container } = render(CountUp, { props: { cents: 3712 } });
    // jsdom has no matchMedia → store is false → it animates; it must land on the target
    await waitFor(() => expect(container.textContent).toBe('$37.12'), { timeout: 1500 });
  });
  it('uses tabular-nums so width does not reflow', () => {
    const { container } = render(CountUp, { props: { cents: 100 } });
    expect(container.querySelector('span')?.getAttribute('style')).toContain('tabular-nums');
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/components/CountUp.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** `src/lib/components/CountUp.svelte`:

```svelte
<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { get } from 'svelte/store';
  import { dur, prefersReducedMotion } from '$lib/motion';
  import { formatCents } from '$lib/money';

  let { cents, currency = 'USD' }: { cents: number; currency?: string } = $props();
  const reduced = get(prefersReducedMotion);
  // start at the target under reduced motion (no count), else count up from 0
  const value = tweened(reduced ? cents : 0, {
    duration: reduced ? 0 : dur.slow * 1000,
    easing: cubicOut
  });
  $effect(() => { value.set(cents); });
  const display = $derived(formatCents(Math.round($value), currency));
</script>
<span style="font-variant-numeric: tabular-nums">{display}</span>
```

- [ ] **Step 4: Run** `npx vitest run src/lib/components/CountUp.test.ts` → PASS (the animated value lands on `$37.12`). `npm run check` → 0 errors.
- [ ] **Step 5: Commit** `git add src/lib/components/CountUp.svelte src/lib/components/CountUp.test.ts && git commit -m "feat(motion): CountUp — tweened amount that lands on the target (reduced-motion jumps)"`

---

## Task 3: `VerifySeal.svelte`

**Files:** Create `src/lib/components/VerifySeal.svelte`, `src/lib/components/VerifySeal.test.ts`.

- [ ] **Step 1: Write the failing test** `src/lib/components/VerifySeal.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import VerifySeal from './VerifySeal.svelte';

describe('VerifySeal', () => {
  it('renders the check fully drawn in the static (play=false) state', () => {
    const { container } = render(VerifySeal, { props: { play: false, tone: 'verified' } });
    const path = container.querySelector('path');
    expect(path?.getAttribute('style')).toContain('stroke-dashoffset:0');
    // verified circle is green-filled
    expect(container.querySelector('circle')?.getAttribute('fill')).toBe('var(--green)');
  });
  it('renders a neg ✕ for tone=rejected, never green', () => {
    const { container } = render(VerifySeal, { props: { play: false, tone: 'rejected' } });
    expect(container.querySelector('circle')?.getAttribute('fill')).toBe('none');
    expect(container.innerHTML).not.toContain('var(--green)');
    expect(container.innerHTML).toContain('var(--neg)');
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/components/VerifySeal.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** `src/lib/components/VerifySeal.svelte`:

```svelte
<script lang="ts">
  import { get } from 'svelte/store';
  import { prefersReducedMotion } from '$lib/motion';

  let { play = false, tone = 'verified', size = 28 }: {
    play?: boolean; tone?: 'verified' | 'rejected'; size?: number;
  } = $props();

  const reduced = get(prefersReducedMotion);
  const LEN = 20; // approx length of the check polyline for the draw

  // drawn immediately when static or reduced; otherwise start undrawn then flip on next frame to transition
  let drawn = $state(!play || reduced);
  $effect(() => {
    if (play && !reduced) {
      drawn = false;
      requestAnimationFrame(() => { drawn = true; });
    } else {
      drawn = true;
    }
  });
</script>

<svg width={size} height={size} viewBox="0 0 24 24" class:pop={play && !reduced && tone === 'verified'}
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

> Note: the rejected ✕ path also carries `stroke-dashoffset:0` so the verified-state test's selector (`path` has offset 0) and the rejected test (no green) are both unambiguous. The `.pop` keyframe is auto-neutralized by the global `prefers-reduced-motion` block in app.css.

- [ ] **Step 4: Run** `npx vitest run src/lib/components/VerifySeal.test.ts` → PASS; `npm run check` → 0 errors.
- [ ] **Step 5: Commit** `git add src/lib/components/VerifySeal.svelte src/lib/components/VerifySeal.test.ts && git commit -m "feat(motion): VerifySeal — check-draw + green pop / reject ✕"`

---

## Task 4: Keyframes + orchestration helper

**Files:** Modify `src/app.css`; create `src/lib/review-motion.ts`, `src/lib/review-motion.test.ts`.

- [ ] **Step 1: Add keyframes** to `src/app.css` (append at end — the global reduced-motion block already covers them):

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
.row-dim { opacity: .5; transition: opacity var(--dur-base) var(--ease-snappy); }
```

(Confirm `--ease-out-soft` and `--ease-snappy` exist in app.css `:root`; CLAUDE.md §3 defines them — if a token is absent, add it from CLAUDE.md §3 verbatim.)

- [ ] **Step 2: Write the failing test** `src/lib/review-motion.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { makeOutcomeEnhancer, HOLD_MS } from './review-motion';

function run(opts: Partial<Parameters<typeof makeOutcomeEnhancer>[0]> = {}) {
  const calls: string[] = [];
  const hold = vi.fn(() => { calls.push('hold'); return Promise.resolve(); });
  const enhancer = makeOutcomeEnhancer({
    kind: 'verifying', reduced: false,
    isPending: () => false,
    begin: () => calls.push('begin'),
    finish: () => calls.push('finish'),
    hold,
    ...opts
  });
  return { enhancer, calls, hold };
}

describe('makeOutcomeEnhancer', () => {
  it('cancels (and does not begin) when already pending', () => {
    const cancel = vi.fn();
    const { enhancer, calls } = run({ isPending: () => true });
    const cb = enhancer({ cancel } as any);
    expect(cancel).toHaveBeenCalled();
    expect(cb).toBeUndefined();
    expect(calls).not.toContain('begin');
  });
  it('on success: begin → hold(HOLD_MS) → update → finish, in order', async () => {
    const { enhancer, calls, hold } = run();
    const update = vi.fn(() => { calls.push('update'); return Promise.resolve(); });
    const result = enhancer({ cancel: vi.fn() } as any)!;
    await result({ result: { type: 'success' }, update } as any);
    expect(hold).toHaveBeenCalledWith(HOLD_MS.verifying);
    expect(calls).toEqual(['begin', 'hold', 'update', 'finish']);
  });
  it('reduced motion skips the hold', async () => {
    const { enhancer, calls } = run({ reduced: true });
    const update = vi.fn(() => { calls.push('update'); return Promise.resolve(); });
    await enhancer({ cancel: vi.fn() } as any)!({ result: { type: 'success' }, update } as any);
    expect(calls).toEqual(['begin', 'update', 'finish']);
  });
  it('failure result skips the hold but still updates + finishes', async () => {
    const { enhancer, calls } = run();
    const update = vi.fn(() => { calls.push('update'); return Promise.resolve(); });
    await enhancer({ cancel: vi.fn() } as any)!({ result: { type: 'failure' }, update } as any);
    expect(calls).toEqual(['begin', 'update', 'finish']);
  });
  it('runs prepare(input) before begin, in the before-submit phase', () => {
    const calls: string[] = [];
    const enhancer = makeOutcomeEnhancer({
      kind: 'verifying', reduced: false, isPending: () => false,
      prepare: (input: any) => calls.push('prepare:' + input.formData.get('payout')),
      begin: () => calls.push('begin'), finish: () => {}, hold: () => Promise.resolve()
    });
    enhancer({ cancel: vi.fn(), formData: new Map([['payout', '5']]) } as any);
    expect(calls).toEqual(['prepare:5', 'begin']);
  });
});
```

- [ ] **Step 3: Run** `npx vitest run src/lib/review-motion.test.ts` → FAIL (module missing).

- [ ] **Step 4: Implement** `src/lib/review-motion.ts`:

```ts
import type { SubmitFunction } from '@sveltejs/kit';

export type OutcomeKind = 'verifying' | 'rejecting' | 'revising';

/** Sequence durations (ms): the full moment reads ~700ms; dismissals are quicker (CLAUDE.md §2.3). */
export const HOLD_MS: Record<OutcomeKind, number> = { verifying: 700, rejecting: 260, revising: 260 };

/**
 * Build a `use:enhance` SubmitFunction that plays the review-outcome moment, then refetches.
 * Two phases: (before-submit) cancel if already pending, else begin() — mounts the seal/glow now,
 * overlapping the server round-trip; (result) hold for the sequence on SUCCESS (skipped under
 * reduced motion or on a fail() result), then update() to refetch, then finish().
 */
export function makeOutcomeEnhancer(opts: {
  kind: OutcomeKind;
  reduced: boolean;
  isPending: () => boolean;
  begin: () => void;
  finish: () => void;
  /** Before-submit hook with the SubmitFunction input (e.g. read formData to capture the payout). */
  prepare?: (input: Parameters<SubmitFunction>[0]) => void;
  hold?: (ms: number) => Promise<void>;
}): SubmitFunction {
  const hold = opts.hold ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  return (input) => {
    if (opts.isPending()) {
      input.cancel();
      return;
    }
    opts.prepare?.(input);
    opts.begin();
    return async ({ result, update }) => {
      if (result.type === 'success' && !opts.reduced) await hold(HOLD_MS[opts.kind]);
      await update();
      opts.finish();
    };
  };
}
```

- [ ] **Step 5: Run** `npx vitest run src/lib/review-motion.test.ts` → PASS; `npm run check` → 0 errors.
- [ ] **Step 6: Commit** `git add src/app.css src/lib/review-motion.ts src/lib/review-motion.test.ts && git commit -m "feat(motion): payout-glow + reject-settle keyframes + makeOutcomeEnhancer orchestration"`

---

## Task 5: Wire the console review queue

**Files:** Modify `src/routes/console/+page.svelte`.

Convert the per-row `verify` / `request_revision` / `reject` forms to `use:enhance` driving the
moment. Keep the create form a plain POST (out of scope). The full verify moment shows the seal +
`CountUp` (to the entered payout) + `payout-glow`; revision/reject show the settle + dim.

- [ ] **Step 1: Replace the `<script>` and the review-queue `{#each}`** in `src/routes/console/+page.svelte`. New script block:

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import { get } from 'svelte/store';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import Money from '$lib/components/Money.svelte';
  import Markdown from '$lib/components/Markdown.svelte';
  import VerifySeal from '$lib/components/VerifySeal.svelte';
  import CountUp from '$lib/components/CountUp.svelte';
  import { makeOutcomeEnhancer, type OutcomeKind } from '$lib/review-motion';
  import { prefersReducedMotion } from '$lib/motion';

  let { data, form } = $props();
  const reduced = get(prefersReducedMotion);

  // per-row moment state, keyed by answer id
  let outcome = $state<Record<string, OutcomeKind | undefined>>({});
  let verifiedCents = $state<Record<string, number>>({});
  const pending = (id: string) => outcome[id] != null;

  function enhancer(id: string, kind: OutcomeKind) {
    return makeOutcomeEnhancer({
      kind, reduced,
      isPending: () => pending(id),
      // for verify: capture the typed payout (dollars→cents) from the submit's formData so CountUp
      // counts to exactly what was sent (runs in the before-submit phase, before begin hides the form)
      prepare: kind === 'verifying'
        ? (input) => {
            const dollars = Number(input.formData.get('payout'));
            if (Number.isFinite(dollars)) verifiedCents = { ...verifiedCents, [id]: Math.round(dollars * 100) };
          }
        : undefined,
      begin: () => { outcome = { ...outcome, [id]: kind }; },
      finish: () => { const o = { ...outcome }; delete o[id]; outcome = o; }
    });
  }
</script>
```

- [ ] **Step 2: Replace the review-queue row markup** (the `{#each data.queue as a (a.id)}` block) with the version below — the row dims/settles via classes, the verify form swaps to the seal+CountUp while `outcome[a.id] === 'verifying'`:

```svelte
  <div class="mb-8 flex flex-col gap-3">
    {#each data.queue as a (a.id)}
      <div class="rounded-2xl border p-5"
           class:reject-settle={outcome[a.id] === 'rejecting' || outcome[a.id] === 'revising'}
           class:row-dim={outcome[a.id] === 'rejecting'}
           class:payout-glow={outcome[a.id] === 'verifying'}
           style="border-color:var(--line); background:var(--surface)">
        <div class="mb-1 flex items-center justify-between gap-2">
          <div>
            <a href="/ideas/{a.idea_id}" class="font-bold" style="color:var(--ink)">{a.title}</a>
            <span class="ml-2 text-xs" style="color:var(--faint)">on “{a.ideas?.title}” · by {a.submitter?.display_name ?? a.submitter?.handle}</span>
          </div>
          {#if outcome[a.id] === 'verifying'}
            <span class="flex items-center gap-2 text-sm font-medium" style="color:var(--green-deep)">
              <VerifySeal play tone="verified" /> Verified · <CountUp cents={verifiedCents[a.id] ?? 0} />
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

        {#if !pending(a.id)}
          <form method="POST" action="?/verify" class="flex flex-wrap items-end gap-2 border-t pt-3"
                style="border-color:var(--line)" use:enhance={enhancer(a.id, 'verifying')}>
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
            <form method="POST" action="?/request_revision" class="flex flex-1 gap-2" use:enhance={enhancer(a.id, 'revising')}>
              <input type="hidden" name="answer_id" value={a.id} />
              <input name="note" placeholder="What to revise" class="flex-1 rounded-xl border px-2 py-1 text-sm" style="border-color:var(--line)" />
              <button class="text-sm" style="color:var(--warn)">Request revision</button>
            </form>
            <form method="POST" action="?/reject" use:enhance={enhancer(a.id, 'rejecting')}>
              <input type="hidden" name="answer_id" value={a.id} />
              <button class="text-sm" style="color:var(--neg)">Reject</button>
            </form>
          </div>
        {/if}
      </div>
    {/each}
  </div>
```

> The `{#if !pending(a.id)}` hides the controls while the moment plays (prevents re-submit; the
> seal/CountUp occupy the header). After `update()` the refetch drops the row from `data.queue`
> entirely (status moved off `submitted`/`under_review`), so the moment is the row's send-off.

- [ ] **Step 3: Verify** `npm run check` → 0 errors. `npm run build` → succeeds. `npx vitest run` → all green (no test broke).
- [ ] **Step 4: Manual smoke** (`npm run dev` on a free port): not headless-feasible to sign in as an expert; instead confirm the page compiles and renders (curl the console route returns 200/redirect) and rely on the unit tests for behavior. Note the observation.
- [ ] **Step 5: Commit** `git add src/routes/console/+page.svelte && git commit -m "feat(console): verify→payout moment + reject/revision settle via use:enhance"`

---

## Task 6: Wire the admin/payouts gate (lighter seal)

**Files:** Modify `src/routes/admin/payouts/+page.svelte`.

Approve = lighter moment (seal pop + glow, **no re-count** — the amount is unchanged; keep the
static `Money`). Reject = settle + dim.

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
  let outcome = $state<Record<string, OutcomeKind | undefined>>({});
  const pending = (id: string) => outcome[id] != null;
  function enhancer(id: string, kind: OutcomeKind) {
    return makeOutcomeEnhancer({
      kind, reduced,
      isPending: () => pending(id),
      begin: () => { outcome = { ...outcome, [id]: kind }; },
      finish: () => { const o = { ...outcome }; delete o[id]; outcome = o; }
    });
  }
</script>
```

- [ ] **Step 2: Replace the `<tbody>` rows** so the action cell swaps to the seal while approving, and the row settles/dims on reject:

```svelte
      {#each data.pending as a (a.id)}
        <tr style="border-top:1px solid var(--line)"
            class:reject-settle={outcome[a.id] === 'rejecting'}
            class:row-dim={outcome[a.id] === 'rejecting'}
            class:payout-glow={outcome[a.id] === 'verifying'}>
          <td class="py-2" style="color:var(--ink)"><a href="/ideas/{a.idea_id}" style="color:var(--green-deep)">{a.title}</a></td>
          <td style="color:var(--muted)">{a.ideas?.title}</td>
          <td style="color:var(--muted)">{a.submitter?.display_name ?? a.submitter?.handle}</td>
          <td class="text-right" style="color:var(--ink)"><Money cents={a.payout_amount_cents} currency={a.payout_currency} /></td>
          <td class="py-2 text-right">
            {#if outcome[a.id] === 'verifying'}
              <span class="inline-flex items-center gap-1 text-sm font-medium" style="color:var(--green-deep)">
                <VerifySeal play tone="verified" size={20} /> Approved
              </span>
            {:else if !pending(a.id)}
              <form method="POST" action="?/approve" class="inline" use:enhance={enhancer(a.id, 'verifying')}>
                <input type="hidden" name="answer_id" value={a.id} />
                <button class="mr-3" style="color:var(--green-deep)">Approve</button>
              </form>
              <form method="POST" action="?/reject" class="inline" use:enhance={enhancer(a.id, 'rejecting')}>
                <input type="hidden" name="answer_id" value={a.id} />
                <button style="color:var(--neg)">Reject</button>
              </form>
            {/if}
          </td>
        </tr>
      {/each}
```

(`verifying` is reused as the approve kind — same `HOLD_MS.verifying` pacing for the lighter seal; no CountUp here.)

- [ ] **Step 3: Verify** `npm run check` → 0 errors; `npm run build` → succeeds; `npx vitest run` → all green.
- [ ] **Step 4: Commit** `git add src/routes/admin/payouts/+page.svelte && git commit -m "feat(payouts): lighter approve seal + reject settle via use:enhance"`

---

## Task 7: Final verification

- [ ] `npx vitest run` (whole repo) green; `npm run check` 0 errors; `npm run build` succeeds; `supabase test db` unchanged-green (no SQL touched).
- [ ] Manual (`npm run dev`): with OS reduced-motion OFF, a verify plays seal+count-up+glow and the row leaves; with reduced-motion ON, states jump (no motion), row still leaves. (If signing in as an expert/admin locally is impractical, note it and rely on the unit suites covering the moment's logic.)
- [ ] Dispatch the final holistic review; then finish the branch (PR).

## Done-when
- `formatCents`, `prefersReducedMotion`, `CountUp`, `VerifySeal`, `makeOutcomeEnhancer` all unit-tested and green; `Money` refactored with no behavior change.
- Console verify shows the full moment (seal → green pop → payout count-up → glow); admin approve shows the lighter seal; reject/revision settle+dim; all jump to final under reduced motion.
- Forms are `use:enhance` (progressive-enhancement fallback still submits); `fail()` skips the success animation.
- No RPC/DB/cloud changes; `npm run check`/`vitest`/`build`/`supabase test db` all green.
