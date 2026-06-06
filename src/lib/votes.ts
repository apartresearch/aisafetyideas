export type VoteTotal = { idea_id: string; score: number };

/** Join vote totals onto idea rows; ideas without votes get score 0 (the view omits them). */
export function attachScores<T extends { id: string }>(
  ideas: T[],
  totals: VoteTotal[]
): (T & { score: number })[] {
  const byIdea = new Map(totals.map((t) => [t.idea_id, t.score]));
  return ideas.map((i) => ({ ...i, score: byIdea.get(i.id) ?? 0 }));
}

/** Score desc, ties broken by created_at desc. */
export function sortTop<T extends { score: number; created_at?: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const x = String(a.created_at ?? ''), y = String(b.created_at ?? '');
    return x < y ? 1 : x > y ? -1 : 0;   // created_at desc, locale-independent
  });
}
