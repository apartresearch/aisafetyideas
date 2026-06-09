import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { rateLimit, RATE_LIMIT_MESSAGE } from '$lib/server/rate-limit';

async function requireAdmin(supabase: any, userId: string | undefined) {
  if (!userId) return false;
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', userId).single();
  return data?.is_admin === true;
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) redirect(303, '/login?next=/admin/users');
  if (!(await requireAdmin(supabase, user.id))) error(403, 'Admins only');

  const [{ data: profiles }, { data: experts }] = await Promise.all([
    supabase.from('profiles').select('id, handle, display_name, is_admin').order('handle'),
    supabase.from('experts').select('id, status')
  ]);
  const expertStatus = new Map<string, string>((experts ?? []).map((e: any) => [e.id, e.status]));
  const users = (profiles ?? []).map((p: any) => ({
    id: p.id,
    handle: p.handle,
    display_name: p.display_name,
    is_admin: p.is_admin === true,
    expert_status: expertStatus.get(p.id) ?? null
  }));
  return { users, currentUserId: user.id };
};

export const actions: Actions = {
  setExpert: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireAdmin(supabase, user.id))) return fail(403, { message: 'Admins only' });
    if (!(await rateLimit(supabase, 'admin')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const fd = await request.formData();
    const profile = String(fd.get('id'));
    const approved = String(fd.get('approved')) === 'true';
    const { error: e } = await supabase.rpc('admin_set_expert', { p_profile: profile, p_approved: approved });
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  },
  setAdmin: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireAdmin(supabase, user.id))) return fail(403, { message: 'Admins only' });
    if (!(await rateLimit(supabase, 'admin')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const fd = await request.formData();
    const profile = String(fd.get('id'));
    const isAdmin = String(fd.get('is_admin')) === 'true';
    const { error: e } = await supabase.rpc('admin_set_admin', { p_profile: profile, p_is_admin: isAdmin });
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  }
};
