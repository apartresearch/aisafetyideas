import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { renderMarkdown } from '$lib/server/markdown';
import { rateLimit, RATE_LIMIT_MESSAGE } from '$lib/server/rate-limit';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, handle, display_name, avatar_url, bio_md, career_stage')
    .eq('handle', params.handle)
    .single();
  if (!profile) error(404, 'Profile not found');

  const [{ data: expert }, { data: authored }, { data: earningsRow }] = await Promise.all([
    supabase.from('experts').select('status').eq('id', profile.id).maybeSingle(),
    supabase
      .from('ideas')
      .select('id, slug, title, summary_md, type, status')
      .eq('author_id', profile.id)
      .not('status', 'in', '(draft,archived)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('profile_earnings')
      .select('lifetime_cents, payout_count')
      .eq('profile_id', profile.id)
      .maybeSingle()
  ]);

  const earnings = {
    lifetime_cents: (earningsRow as any)?.lifetime_cents ?? 0,
    payout_count: (earningsRow as any)?.payout_count ?? 0
  };

  return {
    profile,
    bio_html: renderMarkdown(profile.bio_md),
    isVerifiedExpert: expert?.status === 'approved',
    authored: authored ?? [],
    earnings
  };
};

export const actions: Actions = {
  update: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in required' });
    if (!(await rateLimit(supabase, 'profile')).ok) return fail(429, { message: RATE_LIMIT_MESSAGE });
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
