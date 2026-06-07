import { defineConfig } from '@playwright/test';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // Serial: the verify→payout moment is asserted within its ~700ms success-gated hold (the row then
  // refetches away). Parallel workers contend for the main thread and miss that window → flaky. The
  // suite is ~15s serial, so workers:1 is cheap insurance; CI retries blunt any residual timing blip.
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  // do NOT force reducedMotion — reduced motion skips the hold and the seal would vanish before
  // Playwright could assert it.
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,   // cold-runner SvelteKit build+preview can approach the 60s default
    env: {
      PUBLIC_SUPABASE_URL: SUPABASE_URL,
      PUBLIC_SUPABASE_ANON_KEY: ANON
    }
  }
});
