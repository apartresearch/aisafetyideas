import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

async function requireAdmin(supabase: any, userId: string | undefined) {
  if (!userId) return false;
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', userId).single();
  return data?.is_admin === true;
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession }, url }) => {
  const { user } = await safeGetSession();
  if (!user) redirect(303, '/login?next=/admin/invites');
  if (!(await requireAdmin(supabase, user.id))) error(403, 'Admins only');

  const { data: invites } = await supabase
    .from('expert_invites')
    .select('id, token, max_uses, used_count, specialty, expires_at, created_at')
    .order('created_at', { ascending: false });

  const origin = url.origin;
  return {
    invites: (invites ?? []).map((inv: any) => ({
      ...inv,
      invite_url: `${origin}/invite/${inv.token}`
    }))
  };
};

export const actions: Actions = {
  create: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireAdmin(supabase, user.id))) return fail(403, { message: 'Admins only' });

    const fd = await request.formData();
    const token = crypto.randomUUID();
    const max_uses = Math.max(1, parseInt(String(fd.get('max_uses') ?? '1'), 10) || 1);
    const specialty = String(fd.get('specialty') ?? '').trim() || null;
    const expires_raw = String(fd.get('expires_at') ?? '').trim();
    const expires_at = expires_raw ? new Date(expires_raw).toISOString() : null;

    const { error: e } = await supabase.from('expert_invites').insert({
      token,
      created_by: user.id,
      max_uses,
      specialty,
      expires_at
    });
    if (e) return fail(400, { message: e.message });
    return { created: true, token };
  },

  revoke: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireAdmin(supabase, user.id))) return fail(403, { message: 'Admins only' });

    const fd = await request.formData();
    const id = String(fd.get('id'));
    const { error: e } = await supabase.from('expert_invites').delete().eq('id', id);
    if (e) return fail(400, { message: e.message });
    return { revoked: true };
  }
};
