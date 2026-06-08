import type { SupabaseClient } from '@supabase/supabase-js';
import { attachScores, sortTop, type VoteTotal } from '$lib/votes';

export const PAGE_SIZE = 24;
export type IdeaSort = 'top' | 'new';

/** Parse the `sort` query param. Default is 'top' = net upvotes (score = upvotes − downvotes). */
export function parseSort(value: string | null): IdeaSort {
  return value === 'new' ? 'new' : 'top';
}

/** Statuses never shown in public listings: drafts (unpublished) and archived (admin-hidden). */
const HIDDEN_STATUSES = '(draft,archived)';

export type VerifiedSolution = { id: string; title: string };
export type IdeaListItem = {
  id: string;
  slug: string;
  title: string;
  summary_md: string | null;
  type: string;
  status: string;
  created_at: string | null;
  score: number;
  answerCount: number;
  commentCount: number;
  verified: VerifiedSolution | null;
};

/**
 * Attach per-card engagement stats (answers, comments, first verified solution) to a page of ideas.
 * Two small reads keyed by the page's idea ids — RLS governs visibility (same as the detail page).
 */
async function enrichCards(
  supabase: SupabaseClient,
  ideas: (Record<string, unknown> & { id: string; score: number })[]
): Promise<IdeaListItem[]> {
  if (!ideas.length) return ideas as IdeaListItem[];
  const ids = ideas.map((i) => i.id);
  const [{ data: answers }, { data: comments }] = await Promise.all([
    supabase.from('answers').select('idea_id, id, title, status').in('idea_id', ids),
    supabase.from('comments').select('idea_id').in('idea_id', ids)
  ]);

  const stats = new Map<string, { answerCount: number; commentCount: number; verified: VerifiedSolution | null }>();
  for (const id of ids) stats.set(id, { answerCount: 0, commentCount: 0, verified: null });
  for (const a of (answers ?? []) as { idea_id: string; id: string; title: string; status: string }[]) {
    const s = stats.get(a.idea_id);
    if (!s) continue;
    s.answerCount++;
    if (a.status === 'verified' && !s.verified) s.verified = { id: a.id, title: a.title };
  }
  for (const c of (comments ?? []) as { idea_id: string }[]) {
    const s = stats.get(c.idea_id);
    if (s) s.commentCount++;
  }
  return ideas.map((i) => ({ ...i, ...stats.get(i.id)! })) as IdeaListItem[];
}

export type IdeaFeedPage = {
  ideas: IdeaListItem[];
  count: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

/**
 * One page of the public ideas feed, with vote scores attached and archived/draft ideas excluded.
 * Shared by the SSR page loader and the /api/ideas infinite-scroll endpoint so both stay in lockstep.
 *
 * 'new' sorts in the DB and pages with range(). 'top' (net upvotes) needs a global score sort, so it
 * fetches the whole (small, < 1000-row) set, ranks in memory, and slices the page — same caveat as
 * before: revisit if the idea count ever approaches PostgREST's 1000-row cap.
 */
export async function loadIdeaFeed(
  supabase: SupabaseClient,
  opts: { type?: string | null; sort: IdeaSort; page: number }
): Promise<IdeaFeedPage> {
  const page = Math.max(0, Math.trunc(opts.page) || 0);

  const { data: rawTotals } = await supabase.from('idea_vote_totals').select('idea_id, score');
  const totals: VoteTotal[] = (rawTotals ?? []).flatMap((t: { idea_id: string | null; score: number | null }) =>
    t.idea_id ? [{ idea_id: t.idea_id, score: t.score ?? 0 }] : []
  );

  let base = supabase
    .from('ideas')
    .select('id, slug, title, summary_md, type, status, created_at', { count: 'exact' })
    .not('status', 'in', HIDDEN_STATUSES);
  if (opts.type === 'hypothesis' || opts.type === 'open_ended') base = base.eq('type', opts.type);

  if (opts.sort === 'top') {
    const { data: all } = await base.order('created_at', { ascending: false });
    const ranked = sortTop(attachScores(all ?? [], totals));
    const start = page * PAGE_SIZE;
    return {
      ideas: await enrichCards(supabase, ranked.slice(start, start + PAGE_SIZE)),
      count: ranked.length,
      page,
      pageSize: PAGE_SIZE,
      hasMore: start + PAGE_SIZE < ranked.length
    };
  }

  const { data: ideas, count } = await base
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  const total = count ?? 0;
  return {
    ideas: await enrichCards(supabase, attachScores(ideas ?? [], totals)),
    count: total,
    page,
    pageSize: PAGE_SIZE,
    hasMore: (page + 1) * PAGE_SIZE < total
  };
}
