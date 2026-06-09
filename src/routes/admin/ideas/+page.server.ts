import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

const SELECT =
  'id, slug, title, summary_md, status, author:profiles!ideas_author_id_fkey(handle, display_name)';

const flatten = (rows: any[] | null) =>
  (rows ?? []).map((row: any) => ({
    ...row,
    author: Array.isArray(row.author) ? (row.author[0] ?? null) : row.author
  }));

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) redirect(303, '/login?next=/admin/ideas');
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) error(403, 'Admins only');

  // Primary view: the review queue - non-expert submissions awaiting moderation.
  const { data: review } = await supabase
    .from('ideas').select(SELECT).eq('status', 'review').order('created_at', { ascending: false });

  // Secondary: rejected/hidden ideas (kept for the legacy promote-from-archived affordance).
  const { data: archived } = await supabase
    .from('ideas').select(SELECT).eq('status', 'archived').order('created_at', { ascending: false });

  return { review: flatten(review), archived: flatten(archived) };
};

async function requireAdmin(supabase: any, safeGetSession: any) {
  const { user } = await safeGetSession();
  if (!user) return { fail: fail(401, { message: 'Sign in' }) };
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!me?.is_admin) return { fail: fail(403, { message: 'Admins only' }) };
  return { user };
}

export const actions: Actions = {
  // Moderate a review idea via the admin-only DEFINER RPC: approve → open, request_changes →
  // draft (author revises), reject → archived.
  moderate: async ({ request, locals: { supabase, safeGetSession } }) => {
    const guard = await requireAdmin(supabase, safeGetSession);
    if (guard.fail) return guard.fail;
    const fd = await request.formData();
    const action = String(fd.get('action') ?? '');
    if (!['approve', 'request_changes', 'reject'].includes(action)) {
      return fail(400, { message: 'Unknown action' });
    }
    const { error: e } = await supabase.rpc('admin_moderate_idea', {
      p_idea: String(fd.get('id')),
      p_action: action
    });
    if (e) return fail(400, { message: e.message });
    return { moderated: true, action };
  },

  // Legacy: promote an archived idea straight to open.
  promote: async ({ request, locals: { supabase, safeGetSession } }) => {
    const guard = await requireAdmin(supabase, safeGetSession);
    if (guard.fail) return guard.fail;
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
