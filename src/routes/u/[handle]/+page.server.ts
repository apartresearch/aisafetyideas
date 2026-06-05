import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { renderMarkdown } from '$lib/server/markdown';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, handle, display_name, avatar_url, bio_md, career_stage')
    .eq('handle', params.handle)
    .single();
  if (!profile) error(404, 'Profile not found');
  return { profile, bio_html: renderMarkdown(profile.bio_md) };
};

export const actions: Actions = {
  update: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in required' });
    const fd = await request.formData();
    const { error: e } = await supabase
      .from('profiles')
      .update({
        display_name: String(fd.get('display_name') ?? ''),
        bio_md: String(fd.get('bio_md') ?? ''),
        career_stage: String(fd.get('career_stage') ?? '')
      })
      .eq('id', user.id);                 // RLS guarantees only own row is writable
    if (e) return fail(400, { message: e.message });
    return { saved: true };
  }
};
