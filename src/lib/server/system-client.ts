import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env as pub } from '$env/dynamic/public';
import { env } from '$env/dynamic/private';

// A Supabase client authenticated as the dedicated system user (whose profile is_admin).
// Used ONLY by the Stripe webhook to call admin-only money RPCs without a service-role key -
// the owner principle: no service-role client anywhere; RLS/auth is the only authority.
export async function getSystemClient(): Promise<SupabaseClient> {
  const client = createClient(pub.PUBLIC_SUPABASE_URL!, pub.PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { error } = await client.auth.signInWithPassword({
    email: env.SYSTEM_USER_EMAIL!,
    password: env.SYSTEM_USER_PASSWORD!
  });
  if (error) throw new Error('system auth failed: ' + error.message);
  return client;
}
