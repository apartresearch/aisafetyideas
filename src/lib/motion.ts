export const spring = {
  snappy: { stiffness: 420, damping: 34, mass: 1 },
  smooth: { stiffness: 260, damping: 30, mass: 1 },
  gentle: { stiffness: 160, damping: 26, mass: 1 }
} as const;
export const dur = { instant: .08, fast: .14, base: .22, slow: .36, slower: .52 } as const;

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
