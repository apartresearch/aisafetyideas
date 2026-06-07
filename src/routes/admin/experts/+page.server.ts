import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Database } from '$lib/types/database';
import { rateLimit, RATE_LIMIT_MESSAGE } from '$lib/server/rate-limit';

type ExpertUpdate = Database['public']['Tables']['experts']['Update'];

async function requireAdmin(supabase: any, userId: string | undefined) {
  if (!userId) return false;
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', userId).single();
  return data?.is_admin === true;
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) redirect(303, '/login?next=/admin/experts');
  if (!(await requireAdmin(supabase, user.id))) error(403, 'Admins only');
  const { data: experts } = await supabase
    .from('experts').select('id, status, specialty, profiles!experts_id_fkey(handle, display_name)')
    .order('created_at', { ascending: false });
  return { experts: experts ?? [] };
};

export const actions: Actions = {
  setStatus: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireAdmin(supabase, user.id))) return fail(403, { message: 'Admins only' });
    if (!(await rateLimit(supabase, 'admin')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
    const fd = await request.formData();
    const id = String(fd.get('id'));
    const status = String(fd.get('status'));
    if (!['approved', 'revoked', 'pending'].includes(status)) return fail(400, { message: 'Bad status' });
    const patch: ExpertUpdate = { status };
    if (status === 'approved') { patch.approved_by = user.id; patch.approved_at = new Date().toISOString(); }
    const { error: e } = await supabase.from('experts').update(patch).eq('id', id); // RLS: admins manage experts
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  }
};
