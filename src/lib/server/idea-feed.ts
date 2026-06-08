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

export type IdeaListItem = {
  id: string;
  slug: string;
  title: string;
  summary_md: string | null;
  type: string;
  status: string;
  created_at: string | null;
  score: number;
};

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
    const ranked = sortTop(attachScores(all ?? [], totals)) as IdeaListItem[];
    const start = page * PAGE_SIZE;
    return {
      ideas: ranked.slice(start, start + PAGE_SIZE),
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
    ideas: attachScores(ideas ?? [], totals) as IdeaListItem[],
    count: total,
    page,
    pageSize: PAGE_SIZE,
    hasMore: (page + 1) * PAGE_SIZE < total
  };
}
