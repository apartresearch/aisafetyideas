import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const { data: rawExperts } = await supabase
    .from('experts')
    .select('id, specialty, featured, profiles!experts_id_fkey(handle, display_name)')
    .eq('status', 'approved')
    .order('featured', { ascending: false });
  const experts = (rawExperts ?? []).map((e: any) => ({
    id: e.id,
    specialty: e.specialty,
    featured: e.featured,
    profile: Array.isArray(e.profiles) ? (e.profiles[0] ?? null) : e.profiles
  }));
  return { experts };
};
