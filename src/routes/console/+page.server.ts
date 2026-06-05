import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

async function requireExpert(supabase: any, userId: string | undefined) {
  if (!userId) return false;
  const { data } = await supabase.from('experts').select('status').eq('id', userId).single();
  return data?.status === 'approved';
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) redirect(303, '/login?next=/console');
  if (!(await requireExpert(supabase, user.id))) error(403, 'Approved experts only');
  const { data: ideas } = await supabase
    .from('ideas').select('id, title, type, status').eq('author_id', user.id)
    .order('created_at', { ascending: false });
  return { ideas: ideas ?? [] };
};

export const actions: Actions = {
  create: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireExpert(supabase, user.id))) return fail(403, { message: 'Approved experts only' });
    const fd = await request.formData();
    const title = String(fd.get('title') ?? '').trim();
    if (!title) return fail(400, { message: 'Title required' });
    const type = fd.get('type') === 'hypothesis' ? 'hypothesis' : 'open_ended';
    const { data, error: e } = await supabase.from('ideas').insert({
      author_id: user.id, title, type,
      summary_md: String(fd.get('summary_md') ?? ''),
      claim: type === 'hypothesis' ? String(fd.get('claim') ?? '') : null,
      status: 'open', published_at: new Date().toISOString()
    }).select('id').single();          // RLS enforces approved-expert + own-author
    if (e) return fail(400, { message: e.message });
    redirect(303, `/ideas/${data!.id}`);
  }
};
