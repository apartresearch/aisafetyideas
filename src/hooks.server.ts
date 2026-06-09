import { createServerClient } from '@supabase/ssr';
import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { env } from '$env/dynamic/public';

const supabase: Handle = async ({ event, resolve }) => {
  event.locals.supabase = createServerClient(env.PUBLIC_SUPABASE_URL!, env.PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      setAll: (toSet) =>
        toSet.forEach(({ name, value, options }) =>
          event.cookies.set(name, value, { ...options, path: '/' }))
    }
  });

  event.locals.safeGetSession = async () => {
    const { data: { session } } = await event.locals.supabase.auth.getSession();
    if (!session) return { session: null, user: null };
    // ALWAYS validate the JWT with getUser() - never trust getSession alone
    const { data: { user }, error } = await event.locals.supabase.auth.getUser();
    if (error) return { session: null, user: null };
    return { session, user };
  };

  return resolve(event, {
    filterSerializedResponseHeaders: (name) =>
      name === 'content-range' || name === 'x-supabase-api-version'
  });
};

const PROTECTED = ['/dashboard', '/console', '/admin']; // NOT /u - profiles are public to view

const authGuard: Handle = async ({ event, resolve }) => {
  const { session, user } = await event.locals.safeGetSession();
  event.locals.session = session;
  event.locals.user = user;
  if (!user && PROTECTED.some((p) => event.url.pathname.startsWith(p))) {
    redirect(303, `/login?next=${encodeURIComponent(event.url.pathname)}`);
  }
  return resolve(event);
};

export const handle = sequence(supabase, authGuard);
