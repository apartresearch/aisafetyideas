import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { loginLimited } from '$lib/server/rate-limit';

// same-origin absolute paths only (block "//evil.com" and full URLs), matching /auth/callback
function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

export const load: PageServerLoad = async ({ url }) => ({ next: safeNext(url.searchParams.get('next')) });

export const actions: Actions = {
  google: async ({ url, getClientAddress, locals: { supabase } }) => {
    if (loginLimited(getClientAddress()))
      return fail(429, { message: 'Too many attempts — try again in a few minutes.' });
    const next = safeNext(url.searchParams.get('next'));
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${url.origin}/auth/callback?next=${encodeURIComponent(next)}` }
    });
    if (error) return fail(400, { message: error.message });
    redirect(303, data.url);
  },
  magiclink: async ({ request, url, getClientAddress, locals: { supabase } }) => {
    if (loginLimited(getClientAddress()))
      return fail(429, { message: 'Too many attempts — try again in a few minutes.' });
    const next = safeNext(url.searchParams.get('next'));
    const email = String((await request.formData()).get('email') ?? '');
    if (!email) return fail(400, { message: 'Email required' });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${url.origin}/auth/callback?next=${encodeURIComponent(next)}` }
    });
    if (error) return fail(400, { message: error.message });
    return { sent: true };
  }
};
