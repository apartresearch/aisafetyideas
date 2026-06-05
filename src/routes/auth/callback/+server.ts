import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
  const code = url.searchParams.get('code');
  const rawNext = url.searchParams.get('next') ?? '/';
  // only allow same-origin absolute paths (block "//evil.com" and full URLs)
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(303, next);
  }
  redirect(303, '/auth/error');
};
