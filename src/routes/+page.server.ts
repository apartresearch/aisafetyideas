import type { PageServerLoad } from './$types';

// Landing page: a few recent open ideas + headline counts. Degrades gracefully - if any query
// fails or returns nothing (e.g. before the production deploy can read the DB), the section hides.
export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
  const [{ data: recent }, ideasCount, expertsCount] = await Promise.all([
    supabase.from('ideas').select('id, slug, title, summary_md, type, status')
      .not('status', 'in', '(draft,archived)').order('created_at', { ascending: false }).limit(3),
    supabase.from('ideas').select('id', { count: 'exact', head: true }).not('status', 'in', '(draft,archived)'),
    supabase.from('experts').select('id', { count: 'exact', head: true }).eq('status', 'approved')
  ]);
  return {
    recent: recent ?? [],
    ideaCount: ideasCount.count ?? 0,
    expertCount: expertsCount.count ?? 0,
    signedIn: !!user
  };
};
