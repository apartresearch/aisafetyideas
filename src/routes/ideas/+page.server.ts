import type { PageServerLoad } from './$types';
import { attachScores, sortTop, type VoteTotal } from '$lib/votes';

const PAGE = 24;
export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
  const type = url.searchParams.get('type');       // 'hypothesis' | 'open_ended' | null
  const sort = url.searchParams.get('sort') === 'top' ? 'top' : 'new';
  const page = Math.max(0, Number(url.searchParams.get('page') ?? 0));

  // vote totals are small (≤ #ideas rows; ~240 today, well under PostgREST's 1000-row cap — revisit
  // both whole-set fetches if the idea count ever approaches 1000) — fetched once for the card scores
  const { data: rawTotals } = await supabase.from('idea_vote_totals').select('idea_id, score');
  // the view's generated types are nullable (aggregate view); normalize to non-null VoteTotal
  const totals: VoteTotal[] = (rawTotals ?? []).flatMap((t) =>
    t.idea_id ? [{ idea_id: t.idea_id, score: t.score ?? 0 }] : []
  );

  let base = supabase
    .from('ideas')
    .select('id, title, summary_md, type, status, created_at', { count: 'exact' })
    .neq('status', 'draft');
  if (type === 'hypothesis' || type === 'open_ended') base = base.eq('type', type);

  if (sort === 'top') {
    // global sort by score needs the whole (small) set; slice the page in memory
    const { data: all } = await base.order('created_at', { ascending: false });
    const ranked = sortTop(attachScores(all ?? [], totals));
    return {
      ideas: ranked.slice(page * PAGE, (page + 1) * PAGE),
      count: ranked.length, page, pageSize: PAGE, type, sort
    };
  }

  const { data: ideas, count } = await base
    .order('created_at', { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  return {
    ideas: attachScores(ideas ?? [], totals),
    count: count ?? 0, page, pageSize: PAGE, type, sort
  };
};
