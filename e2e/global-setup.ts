import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { chromium, type FullConfig } from '@playwright/test';
import { ROLES, mintStorageState, SUPABASE_URL, SUPABASE_ANON_KEY } from './auth';

export default async function globalSetup(_config: FullConfig) {
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // 1. Create users via anon signUp (GoTrue owns the password hash). Tolerate "already registered"
  //    (reruns) AND "rate limit" (GoTrue sign_in_sign_ups trips on rapid local reruns — user exists).
  const tolerable = /already registered|already been registered|rate limit|429/i;
  for (const { email, password } of Object.values(ROLES)) {
    const { error } = await anon.auth.signUp({ email, password });
    if (error && !tolerable.test(error.message)) {
      throw new Error(`signUp failed for ${email}: ${error.message}`);
    }
  }

  // 2. Confirm emails + set roles via SQL (no service-role; psql in the local DB container).
  const seed = readFileSync(new URL('./fixtures/seed.sql', import.meta.url), 'utf8');
  execFileSync('docker', ['exec', '-i', 'supabase_db_aisafetyideas', 'psql', '-U', 'postgres', '-d', 'postgres'],
    { input: seed, stdio: ['pipe', 'inherit', 'inherit'] });

  // 3. Mint a storageState per role.
  for (const { email, password, state } of Object.values(ROLES)) {
    await mintStorageState(email, password, state);
  }

  // 4. Verify each storageState authenticates (fail fast if the cookie format ever drifts).
  const browser = await chromium.launch();
  try {
    for (const { state, email } of Object.values(ROLES)) {
      const ctx = await browser.newContext({ storageState: state });
      const page = await ctx.newPage();
      await page.goto((process.env.E2E_BASE_URL ?? 'http://localhost:4173') + '/dashboard');
      if (/\/login/.test(page.url())) throw new Error(`storageState for ${email} did not authenticate (redirected to /login)`);
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}
