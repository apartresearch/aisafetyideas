import type { LayoutServerLoad } from './$types';
export const load: LayoutServerLoad = async ({ locals: { supabase, safeGetSession }, cookies }) => {
  const { session, user } = await safeGetSession();
  let isAdmin = false;
  if (user) {
    const { data } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    isAdmin = data?.is_admin === true;
  }
  return { session, user, isAdmin, cookies: cookies.getAll() };
};
