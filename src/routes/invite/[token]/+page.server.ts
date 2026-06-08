import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();

  if (!user) {
    redirect(303, '/login?next=' + encodeURIComponent('/invite/' + params.token));
  }

  const { error } = await supabase.rpc('redeem_expert_invite', { p_token: params.token });

  if (!error) {
    redirect(303, '/onboarding/expert');
  }

  // Surface a friendly error — check for "already an approved expert" and redirect gracefully
  if (error.message?.toLowerCase().includes('already an approved expert')) {
    redirect(303, '/onboarding/expert?already=1');
  }

  return { error: error.message };
};
