import type { PageServerLoad } from './$types';

const PAGE = 24;
export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
  const type = url.searchParams.get('type');       // 'hypothesis' | 'open_ended' | null
  const page = Math.max(0, Number(url.searchParams.get('page') ?? 0));
  let q = supabase
    .from('ideas')
    .select('id, title, summary_md, type, status', { count: 'exact' })
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  if (type === 'hypothesis' || type === 'open_ended') q = q.eq('type', type);
  const { data: ideas, count } = await q;
  return { ideas: ideas ?? [], count: count ?? 0, page, pageSize: PAGE, type };
};
