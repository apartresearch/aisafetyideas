import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) redirect(303, '/login?next=/admin/ideas');
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) error(403, 'Admins only');

  const { data: archived } = await supabase
    .from('ideas')
    .select('id, slug, title, summary_md, author:profiles!ideas_author_id_fkey(handle, display_name)')
    .eq('status', 'archived')
    .order('created_at', { ascending: false });

  return { archived: (archived ?? []).map((row: any) => ({
    ...row,
    author: Array.isArray(row.author) ? (row.author[0] ?? null) : row.author
  })) };
};

export const actions: Actions = {
  promote: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, {});
    const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (!me?.is_admin) return fail(403, { message: 'Admins only' });
    const fd = await request.formData();
    const { error: e } = await supabase
      .from('ideas')
      .update({ status: 'open', published_at: new Date().toISOString() })
      .eq('id', String(fd.get('id')))
      .eq('status', 'archived');
    if (e) return fail(400, { message: e.message });
    return { promoted: true };
  }
};
