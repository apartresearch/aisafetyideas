import { redirect, fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
  google: async ({ url, locals: { supabase } }) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${url.origin}/auth/callback?next=/` }
    });
    if (error) return fail(400, { message: error.message });
    redirect(303, data.url);
  },
  magiclink: async ({ request, url, locals: { supabase } }) => {
    const email = String((await request.formData()).get('email') ?? '');
    if (!email) return fail(400, { message: 'Email required' });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${url.origin}/auth/callback?next=/` }
    });
    if (error) return fail(400, { message: error.message });
    return { sent: true };
  }
};
