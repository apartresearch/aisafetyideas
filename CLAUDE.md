# AI Safety Ideas — Brand & Motion Styleguide

> **Project:** 2026 overhaul of the AI Safety Ideas platform (research‑bounty model: experts
> post ideas → funders attach money → submitters answer → author verifies → payout).
> The product spec is being defined separately. **This file is the source of truth for
> brand + motion.** Every interface we build follows it.

The feeling we're after: **precise, earned, alive.** This is a platform where evidence
gets verified and money changes hands — motion should feel as deliberate and trustworthy
as that act, never decorative or bouncy-for-its-own-sake. Think Linear's restraint and
snap, with an editorial, research‑lab texture that no generic SaaS template has.

---

## 1. Brand foundations

### Color

**The interface is greyscale. Bright green is an accent only.** Like the reference
dashboards, all text, headings, surfaces, borders, and dark sections are neutral. The
brand green `#44ff98` appears *only* as an accent: the logo, graph strokes/fills, progress,
focus rings, active/selected marks, and the verify→payout moment. There is **no dark
green** anywhere.

```css
:root {
  /* ── Structure & text: GREYSCALE only (matches the references) ── */
  --ink:        #1a1d1b;   /* headings, primary text */
  --ink-2:      #252525;   /* strong text */
  --body:       #3a3f3d;   /* body copy */
  --muted:      #6b7280;   /* secondary text */
  --faint:      #a0a0a0;   /* captions, tracked labels, axis text */
  --line:       rgba(20, 24, 22, 0.08);   /* hairline borders */
  --line-strong:rgba(20, 24, 22, 0.14);
  --canvas:     #f5f6f5;   /* app background */
  --surface:    #ffffff;   /* cards */
  --surface-2:  #fafbfa;   /* insets, table headers, skeleton base */
  --surface-dk: #1a1d1b;   /* rare dark sections — NEUTRAL, never green */
  --on-dark:    #f5f6f5;   /* text on dark sections */

  /* ── Brand green: ACCENT ONLY ── logo · graphs · strokes · progress ·
        focus · the verify→payout mark. Never structural, never body text. */
  --green:        #44ff98;  /* ★ THE accent — guard this exact value */
  --green-bright: #60ff7b;  /* hover/active brightening of the accent */
  --green-deep:   #1cdb72;  /* ONLY when a small green MARK must stay legible on
                               white (positive delta, verified tick, tiny icon) */

  /* ── Semantic (as in the reference deltas) ── */
  --pos:  #1cdb72;   /* ▲ positive / verified / payout (green, accent) */
  --neg:  #ff375e;   /* ▼ negative / rejected (pink‑red) */
  --warn: #ff9307;
  --info: #0a84ff;

  /* ── Data‑viz: green‑forward on greyscale (no rainbow) ── */
  --chart-1:    #44ff98;     /* primary series = brand accent */
  --chart-2:    #1cdb72;     /* secondary green */
  --chart-ink:  #c7ccc9;     /* inactive / neutral series */
  --chart-grid: var(--line);
  /* use --neg (pink) only for genuinely negative series */
}
```

Usage rules: **never** set `#44ff98` as body/heading text (it fails contrast on white) and
**never** use it as a surface tint. Use `--green-deep` only for *small* green marks that
must read on white (a positive delta, a verified tick). Everything that is "the UI" —
type, cards, dark footers — is neutral greyscale.

### Typography

- **Display / UI:** `Sora` — geometric, slightly technical, on‑brand.
- **Serif accent:** `Lora` — long‑form idea bodies, editorial pull‑quotes, hero lines.
- **Numerals:** always `font-variant-numeric: tabular-nums`. Metrics (`$37.12`, `12,480`,
  `142ms`, payout amounts) must not reflow as they animate. Consider a mono (`Sora`'s
  tnum, or `JetBrains Mono`) for code‑like artifact metadata.
- Small section labels are **UPPERCASE, tracked** (`letter-spacing: .06em`, `--faint`,
  ~12px) — see "AVG. CHEQUE SIZE" in the references.

### Surfaces, radius, shadow, spacing

```css
:root {
  --r-pill: 999px;
  --r-card: 16px;    /* cards, modals */
  --r-ctrl: 12px;    /* inputs, buttons */
  --r-chip: 10px;    /* icon containers, tags */

  /* Soft, low, diffuse — never harsh. Two layers for depth. */
  --shadow-1: 0 1px 2px rgba(20,24,22,.04), 0 1px 1px rgba(20,24,22,.03);
  --shadow-2: 0 2px 4px rgba(20,24,22,.04), 0 4px 12px rgba(20,24,22,.06);
  --shadow-3: 0 8px 24px rgba(20,24,22,.08), 0 2px 6px rgba(20,24,22,.05);
  --shadow-pop: 0 12px 40px rgba(20,24,22,.12);   /* menus, dialogs */

  --space: 4px; /* base unit; use multiples (8/12/16/24/32) */
}
```

Buttons & controls are **pills or 12px‑radius**. **Primary = `--ink` (black) pill** with
white text — exactly like "Export as" in reference #1. Secondary = white + hairline border.
Green is *not* a default button fill; reserve a green‑accent button for a single brand/hero
moment if ever. Dropdowns use the `Label ▾` pattern. Icons frequently live in **10px
rounded‑square chips**.

### Texture — the "unique" layer

This is what separates us from template SaaS. Use sparingly, never behind reading content.

- **Dotted grid** on empty canvases, hero, and section grounds:
  ```css
  background-image: radial-gradient(var(--line) 1px, transparent 1px);
  background-size: 22px 22px;
  ```
- **Halftone / dither texture** (à la reference #3) for hero headers and section dividers:
  a desaturated, low‑opacity monochrome image, optionally given a single `--green`
  `mix-blend-mode: multiply` wash. Editorial, "field‑notes" feel.
- **Grain overlay** (optional, ≤4% opacity) on dark (neutral) sections to avoid banding.
- **Brand orb:** a soft `--green → --green-deep` radial‑gradient sphere (cf. the orb in #1)
  as a recurring hero/empty‑state mascot — the one place the accent goes large. See §6.

---

## 2. Motion principles

1. **Motion is feedback, not decoration.** Every animation answers one of: *what just
   happened*, *where did this come from*, *where did it go*. If it answers none, cut it.
2. **Fast and confident.** Most transitions are **120–260ms**. If a user notices the
   duration, it's too long. Big morphs/sheets may reach ~360ms; nothing in the hot path
   exceeds ~520ms.
3. **Snappy in, faster out.** Entrances are decisive; dismissals are quicker — never make
   someone wait to leave.
4. **Transform & opacity only.** Animate `transform` (translate/scale) and `opacity`.
   Never animate `width/height/top/left/box-shadow` on surfaces in hot paths. *Exception:*
   progress fills (`scaleX`/`width`). Animate shadow by cross‑fading a layered pseudo‑element.
5. **Origin‑aware.** Things grow from where they were triggered (`transform-origin`,
   shared‑element morph). Menus open toward their trigger; cards expand from their card.
6. **Stagger reveals structure.** Lists/grids cascade at **24–32ms** per item, capped at
   ~8 items / ~240ms total — then the rest appear together.
7. **Spring what you grab, ease what you switch.** Springs for draggable / toggled /
   morphing elements (they retarget mid‑flight). Cubic‑bezier curves for discrete
   state‑to‑state transitions.
8. **Interruptible & re‑entrant.** Hovering in/out rapidly must never queue or jank. Prefer
   springs and FLIP that retarget to the current value, not fixed keyframes that restart.
9. **Calm at rest.** Idle screens are still. Ambient motion (orb float, shimmer) is slow,
   subtle, and pauses off‑screen / under reduced‑motion.

---

## 3. Motion tokens

```css
:root {
  /* Durations */
  --dur-instant: 80ms;   /* color/state flips, tooltips */
  --dur-fast:   140ms;   /* hover, press, popovers */
  --dur-base:   220ms;   /* dropdowns, fades, most transitions */
  --dur-slow:   360ms;   /* card expand/morph, modals, count‑up */
  --dur-slower: 520ms;   /* page/hero level — use rarely */

  /* Easings */
  --ease-snappy:     cubic-bezier(0.2, 0, 0, 1);       /* productive, decisive default */
  --ease-out-soft:   cubic-bezier(0.16, 1, 0.3, 1);    /* lush entrances (Linear/Vaul-ish) */
  --ease-emphasized: cubic-bezier(0.32, 0.72, 0, 1);   /* big morphs, sheets, tab indicator */
  --ease-in-out:     cubic-bezier(0.65, 0, 0.35, 1);   /* symmetric A↔B moves */
}
```

Spring presets (Framer Motion / `motion` numbers; Svelte `spring` equivalents in §8):

| Preset   | stiffness | damping | mass | Use                                  |
|----------|-----------|---------|------|--------------------------------------|
| `snappy` | 420       | 34      | 1    | buttons, toggles, popovers, chips    |
| `smooth` | 260       | 30      | 1    | card morph, layout shifts, tab move  |
| `gentle` | 160       | 26      | 1    | hero, orb, drag settle, large sheets |

Default easing for unspecified transitions: `--ease-snappy` at `--dur-base`.

---

## 4. Reduced motion & performance (non‑negotiable)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Under reduced motion: **keep opacity fades, drop all translate/scale/parallax/float**, and
show final states immediately. Count‑ups jump to the final number. Shimmer becomes a static
tint.

Performance budget: 60fps. `will-change` only during an active interaction, removed after.
No animation during scroll. Promote morphing layers to their own compositor layer; never
animate `filter: blur()` on large areas in a loop. Lazy‑mount heavy decorative texture.

---

## 5. Component motion recipes

**Buttons.** Hover: `translateY(-1px)` + shadow `--shadow-1 → --shadow-2`, `--dur-fast`
`--ease-snappy`. Press: `scale(.97)`, instant. Primary is the neutral `--ink` pill;
its hover darkens slightly (no color shift). Disabled never animates.

**Cards (hover).** `translateY(-2px)` + `--shadow-2 → --shadow-3`, `--dur-base`. Optional
hairline `--line → --green` (a thin accent edge). Cursor‑reactive cards may tilt ≤2°
(desktop only, off under reduced motion).

**★ Card expand / morph** (the reference #4→#5 interaction — our signature). A compact card
expands into a detail card via **shared‑element / FLIP**, not a fade‑swap:
- Container morphs size with `smooth` spring (~`--dur-slow`), `transform-origin` at the
  clicked card.
- Persistent elements (title, icon chip, progress bar, avatars) **keep identity** and glide
  to their new positions (Framer `layoutId`, Svelte `crossfade`).
- New rows (checklist, dropdowns) fade+`translateY(6px→0)`, staggered 24ms, after the
  container is ~60% through its morph.
- Progress fill animates to its value during the morph.
- Collapse reverses ~30% faster.

**Lists / grids.** Items: `opacity 0→1` + `translateY(8px→0)`, `--ease-out-soft`,
`--dur-base`, stagger 28ms (cap §2.6). Reorders use FLIP with `smooth` spring.

**Progress bars.** `transform: scaleX()` from current→target, `transform-origin: left`,
`smooth` spring. Fill is brand `--green` (an accent location). On reaching 100% (bounty
fully funded / verified): one subtle sheen sweep + a `--green` glow pulse. This bar carries
the funding/verification story — it's the main place green goes "loud."

**Number count‑up** (metrics, payout amounts, funding totals). Animate value over
`--dur-slow`, ease‑out; `tabular-nums` so width is fixed. Associated delta chip
(`+8.4%` / `−6.2%`) fades+`translateY(4px→0)` in *after* the number settles; `--pos` green
for positive, `--neg` pink for negative, with ▲/▼.

**Modals / dialogs.** Backdrop `opacity 0→1` + `backdrop-filter: blur(0→8px)`, `--dur-base`.
Panel `scale(.96→1)` + `translateY(8px→0)` + fade, `--ease-emphasized`, `--dur-slow`.
Exit: reverse at `--dur-fast`.

**Bottom sheets / side panels.** Slide from the edge with `--ease-emphasized`; draggable
sheets follow the finger 1:1 and settle with `gentle` spring; velocity‑based dismiss.

**Dropdowns / menus / popovers / tooltips.** `scale(.96→1)` + fade, `transform-origin`
toward the trigger, `--dur-fast` `--ease-snappy`. Tooltips: fade + `translateY(2px→0)`,
`--dur-instant→fast`, ~120ms open delay, instant close.

**Tabs.** An active‑indicator bar slides between tabs (shared layout, `--ease-emphasized`);
the bar is `--green` (accent). Panels cross‑fade `--dur-base`. (Cf. reference #3
"Signal / Conversation / Knowledge".)

**Toasts.** Slide+fade from the corner with `snappy` spring; a thin auto‑dismiss progress
line in `--green`; stack with layout spring.

**Focus.** `:focus-visible` → animated 2px `--green` ring + soft outer glow (`box-shadow`
spread `0→4px` at ~30% alpha), fade in `--dur-fast`. Keyboard nav must always be visibly,
beautifully obvious. (Focus is an accent location — green is correct here.)

**★ Verify & payout moment** (product‑defining — treat with care). When an author verifies
an answer: the checkbox/seal draws its check via `stroke-dashoffset`, the circle fills
`--green` with a tiny `scale(1→1.12→1)` pop, `smooth` spring. Then the **payout amount
counts up** with a single `--green` glow pulse on the recipient row. Restrained and earned —
a quiet "this is real money" affirmation, **never** confetti. Rejection: a brief, soft
horizontal settle (no aggressive shake) and the row dims to `--muted`.

**Page transitions.** Route change: outgoing `opacity 1→0` + `translateY(0→-4px)`
(`--dur-fast`); incoming fade + `translateY(6px→0)` (`--dur-base`, `--ease-out-soft`). Keep
total < 300ms; preserve shared headers. Disabled under reduced motion.

**Loading.** Prefer **skeletons** over spinners for content: a slow, calm shimmer sweep
(neutral `--surface-2` → white highlight) or a gentle opacity pulse — **greyscale, not
green**. Inline action spinners only for ≤1s operations.

---

## 6. Ambient / signature touches

- **Orb float:** the brand‑green orb drifts on a slow `translateY` + `scale` loop (~6s,
  `--ease-in-out`, alternate), pausing off‑screen and under reduced motion. Hero / empty
  states / 404 only — the one sanctioned "large green" surface.
- **Dotted‑grid parallax:** on hero, the dotted grid may shift ≤8px on pointer move,
  `gentle` spring — desktop, optional, off under reduced motion.
- **Halftone reveal:** section dividers can wipe their (neutral) halftone texture in with a
  masked `--ease-emphasized` sweep on first scroll‑into‑view (once, not on every scroll).

---

## 7. Do / Don't

**Do**
- Reach for a token (`--dur-*`, `--ease-*`, spring preset) before hand‑writing a curve.
- Keep the UI greyscale; spend green only on logo, data viz, progress, focus, and the
  verify→payout mark.
- Animate `transform`/`opacity`; make every animation interruptible.
- Use the card‑morph and the verify→payout moment as the brand's memorable interactions.
- Test every animated surface with `prefers-reduced-motion: reduce`.

**Don't**
- **No dark green, no green surfaces, no green body/heading text, no `#44ff98` on white.**
- No linear easing on UI. No long (>520ms) hot‑path animations. No bounce/overshoot on
  routine controls (springs are *critically/over‑damped* — settle, don't wobble).
- No animating layout properties (`width/height/top/left/margin`) on surfaces.
- No motion that blocks input or repeats while idle. No confetti, no rainbow charts, no
  spinner where a skeleton fits.

---

## 8. Implementation notes (stack TBD)

Tokens above are **CSS‑first** so they survive whatever framework we land on (SvelteKit 2 or
Next.js — decision pending in the product spec).

- **Svelte / SvelteKit:** use `svelte/motion` `spring`/`tweened` for value animation,
  `svelte/transition` (`fade`, `fly`, `scale`) + `svelte/animate` `flip` for lists, and
  `crossfade` for the shared‑element card morph. Svelte `spring` params differ from the
  table in §3 — start near `{ stiffness: 0.18, damping: 0.45 }` for `snappy`,
  `{ stiffness: 0.1, damping: 0.5 }` for `smooth`, and tune to match feel.
- **React / Next.js:** use `motion` (Framer Motion) with `layoutId` for the card morph and
  tab indicator, `AnimatePresence` for enter/exit, and the spring presets in §3 verbatim.
- Centralize tokens in one `app.css` (`:root`). Expose spring presets as a shared TS/JS
  `motion.ts` constant so React/Svelte both import the same numbers.
- Keep the global design system in `app.css`, **not** inside a Nav component (a mistake in
  the old codebase — theming should not depend on importing a nav).
```ts
// motion.ts — single source of truth for JS-driven springs
export const spring = {
  snappy: { stiffness: 420, damping: 34, mass: 1 },
  smooth: { stiffness: 260, damping: 30, mass: 1 },
  gentle: { stiffness: 160, damping: 26, mass: 1 },
} as const;
export const dur = { instant: .08, fast: .14, base: .22, slow: .36, slower: .52 } as const;
```
