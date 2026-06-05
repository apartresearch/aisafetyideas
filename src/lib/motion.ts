export const spring = {
  snappy: { stiffness: 420, damping: 34, mass: 1 },
  smooth: { stiffness: 260, damping: 30, mass: 1 },
  gentle: { stiffness: 160, damping: 26, mass: 1 }
} as const;
export const dur = { instant: .08, fast: .14, base: .22, slow: .36, slower: .52 } as const;
