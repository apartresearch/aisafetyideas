import { createServerClient } from '@supabase/ssr';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
export const SUPABASE_ANON_KEY =
  process.env.PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const PASSWORD = 'e2e-password-Aa1!';

export type RoleName = 'expert' | 'expert2' | 'funder' | 'submitter' | 'admin';
export const ROLES: Record<RoleName, { email: string; password: string; state: string }> = {
  expert:    { email: 'e2e-expert@example.com',    password: PASSWORD, state: 'e2e/.auth/expert.json' },
  expert2:   { email: 'e2e-expert2@example.com',   password: PASSWORD, state: 'e2e/.auth/expert2.json' },
  funder:    { email: 'e2e-funder@example.com',    password: PASSWORD, state: 'e2e/.auth/funder.json' },
  submitter: { email: 'e2e-submitter@example.com', password: PASSWORD, state: 'e2e/.auth/submitter.json' },
  admin:     { email: 'e2e-admin@example.com',     password: PASSWORD, state: 'e2e/.auth/admin.json' }
};

/**
 * Sign in via the anon client with an IN-MEMORY cookie jar so @supabase/ssr writes the exact
 * session cookie(s) the app reads (correct sb-…-auth-token name, chunking, base64- encoding —
 * no hand-encoding). Persist them as a Playwright storageState file.
 */
export async function mintStorageState(email: string, password: string, statePath: string): Promise<void> {
  const jar = new Map<string, string>();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (toSet) => toSet.forEach(({ name, value }) => jar.set(name, value))
    }
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`mint sign-in failed for ${email}: ${error.message}`);
  if (jar.size === 0) throw new Error(`no cookies minted for ${email}`);

  const storageState = {
    cookies: [...jar].map(([name, value]) => ({
      name, value, domain: 'localhost', path: '/',
      expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' as const
    })),
    origins: []
  };
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify(storageState, null, 2));
}
