import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

async function requireAdmin(supabase: any, userId: string | undefined) {
  if (!userId) return false;
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', userId).single();
  return data?.is_admin === true;
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) redirect(303, '/login?next=/admin');
  if (!(await requireAdmin(supabase, user.id))) error(403, 'Admins only');
  const { data: stats } = await supabase.rpc('admin_dashboard_stats');
  return { stats };
};
