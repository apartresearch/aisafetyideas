# Authed Playwright E2E Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`). Tests-only — NO app/RPC/DB/migration changes. Constraints: never edit CLAUDE.md/docs//.claude//src_legacy_v0/; never `git add .`/`git add -A` (explicit paths). The local Supabase stack must be running (`supabase start`) for any task that runs Playwright.

**Goal:** Cover the research-bounty loop with real authenticated journeys as four distinct roles — proving the loop works end-to-end through the UI (incl. the verify→payout moment), plus key authorization guards.

**Architecture:** A Playwright `global-setup` creates 5 role users via anon `auth.signUp`, sets roles via idempotent SQL, and mints per-role `storageState` by letting `@supabase/ssr` write the session cookies (in-memory jar + `signInWithPassword`) — **no service-role key, no hand-encoded cookies, no OAuth.** Specs drive the golden 4-role loop + negatives with reduced-motion forced for deterministic animation assertions. Spec: `docs/superpowers/specs/2026-06-07-e2e-authed-suite-design.md`.

**Tech Stack:** `@playwright/test` ^1.60, `@supabase/ssr` ^0.10, `@supabase/supabase-js` ^2.107. Local Supabase: URL `http://127.0.0.1:54321`, anon key = the standard local demo JWT, DB container `supabase_db_aisafetyideas`.

---

## Key facts (verified against the codebase)
- App reads `$env/dynamic/public` at runtime → starting `preview` with `PUBLIC_SUPABASE_URL`/`PUBLIC_SUPABASE_ANON_KEY` set points it at local Supabase. (Build doesn't inline them.)
- `handle_new_user` trigger auto-creates a `profiles` row on each `auth.users` insert (so signUp → profile exists).
- Local anon key (non-secret demo value):
  `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0`
- **Real UI selectors** (so the journeys are concrete):
  - `/login`: heading "Sign in"; "Continue with Google" button; email input placeholder `you@email.com`.
  - `/console`: post form — input placeholder `Title`, `<select name=type>`, button **Publish**. Review queue verify form — number input under label `Intended payout ($)`, button **Verify**; **Request revision** button; **Reject** button. On verify success the row header shows the **Verified** seal text + the count-up amount; on reject the row dims; revision keeps it in queue.
  - `/ideas/[id]`: "Submit an answer" link (when `canSubmit`); pledge form — `<input name=amount>`, button **Pledge**; comment form; `StatusBadge`; `BountyMeter`.
  - `/ideas/[id]/answer`: input placeholder `Answer title`, `<textarea name=explanation_md>`, `<textarea name=artifacts>`, button **Submit**.
  - `/admin/payouts`: **Approve** / **Reject** buttons; on approve the cell shows the **Approved** seal.
  - `/dashboard`: heading "Dashboard"; tabs **Feed**/**Discover**; **Follow**/**Following** buttons; "My funding" section with "Total committed".

## File structure

| File | Responsibility |
|---|---|
| `e2e/auth.ts` (new) | `ROLES` constants (email/password/storageState path) + `mintStorageState()` cookie-mint helper |
| `e2e/fixtures/seed.sql` (new) | idempotent SQL: confirm e2e emails + set expert/expert2/admin roles by email |
| `e2e/global-setup.ts` (new) | signUp 5 users (anon), run seed.sql via `docker exec psql`, mint each storageState, verify |
| `playwright.config.ts` (modify) | `globalSetup`, `use.reducedMotion`, webServer `env` → local Supabase |
| `package.json` (modify) | `test:e2e` script |
| `.gitignore` (modify) | ignore `e2e/.auth/` |
| `e2e/loop.spec.ts` (new) | golden 4-role loop (asserts the verify→payout moment) + reject + revision |
| `e2e/guards.spec.ts` (new) | authed-but-unauthorized (member → /console, /admin) + non-author review-queue isolation |
| `e2e/dashboard.spec.ts` (new) | funder: pledge shows in "My funding" + followed-expert feed |

Existing 11 unauthed smoke specs (`auth/ideas/answers/funding/social.spec.ts`) stay untouched.

---

## Task 1: Auth helper + seed SQL + global-setup

**Files:** Create `e2e/auth.ts`, `e2e/fixtures/seed.sql`, `e2e/global-setup.ts`; modify `playwright.config.ts`, `package.json`, `.gitignore`.

- [ ] **Step 1: `.gitignore`** — append a line: `e2e/.auth/`

- [ ] **Step 2: Create `e2e/auth.ts`** — role registry + the cookie-mint helper (lets `@supabase/ssr` encode the cookies; no hardcoding):

```ts
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

  const host = new URL(SUPABASE_URL).hostname; // not used for cookie domain; app runs on localhost
  void host;
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
```

- [ ] **Step 3: Create `e2e/fixtures/seed.sql`** — idempotent role/confirm SQL (matches by email; no service-role, no fixed UUIDs):

```sql
-- Confirm any e2e users whose email isn't confirmed (no-op if local confirmations are off).
update auth.users set email_confirmed_at = now()
  where email like 'e2e-%@example.com' and email_confirmed_at is null;

-- Approved experts (idea authors). on conflict keeps it idempotent across reruns.
insert into public.experts (id, status)
  select id, 'approved' from auth.users
  where email in ('e2e-expert@example.com', 'e2e-expert2@example.com')
  on conflict (id) do nothing;

-- Admin.
update public.profiles set is_admin = true
  where id = (select id from auth.users where email = 'e2e-admin@example.com');
```

- [ ] **Step 4: Create `e2e/global-setup.ts`**:

```ts
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { chromium, type FullConfig } from '@playwright/test';
import { ROLES, mintStorageState, SUPABASE_URL, SUPABASE_ANON_KEY } from './auth';

export default async function globalSetup(_config: FullConfig) {
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // 1. Create users via anon signUp (GoTrue owns the password hash). Ignore "already registered".
  for (const { email, password } of Object.values(ROLES)) {
    const { error } = await anon.auth.signUp({ email, password });
    if (error && !/already registered|already been registered/i.test(error.message)) {
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
```

> Note for the implementer: global-setup runs in Node (not a test). The `/dashboard` verification
> needs the webServer up — Playwright starts `webServer` BEFORE `globalSetup`, so this is fine. If
> the verify step races the server, add a short `await page.waitForLoadState('networkidle')`.

- [ ] **Step 5: Modify `playwright.config.ts`**:

```ts
import { defineConfig } from '@playwright/test';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  // NB: do NOT force reducedMotion here. The verify→payout moment is success-gated and held ~700ms
  // before the row refetches away; under reduced motion that hold is SKIPPED, so the "Verified" seal
  // would vanish before Playwright could assert it. Normal motion keeps the hold window; Playwright's
  // web-first auto-waiting catches the text without any manual timeout (it never waits on the animation).
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    env: {
      PUBLIC_SUPABASE_URL: SUPABASE_URL,
      PUBLIC_SUPABASE_ANON_KEY: ANON
    }
  }
});
```

(The non-secret local anon key is duplicated in `auth.ts` and the config; that's fine — both are
test-only local-dev values. `reducedMotion: 'reduce'` makes the verify→payout moment jump to final.)

- [ ] **Step 6: Add the `test:e2e` script** to `package.json` `scripts`:
  `"test:e2e": "playwright test"`
  (Playwright's `webServer` builds+previews with the local-Supabase env; global-setup seeds. The
  stack must already be running via `supabase start`.)

- [ ] **Step 7: Verify setup runs.** With the local stack up and migrations applied
  (`supabase db reset` if needed), run `npm run test:e2e -- e2e/auth.spec.ts` (the existing smoke
  file) → global-setup creates users + mints all 5 storageStates without error, the smoke tests pass,
  and `e2e/.auth/*.json` exist. (Running an existing spec proves setup works before writing new specs.)

- [ ] **Step 8: Commit** `git add e2e/auth.ts e2e/fixtures/seed.sql e2e/global-setup.ts playwright.config.ts package.json .gitignore && git commit -m "test(e2e): global-setup — signUp roles + mint per-role storageState (no service-role)"`

---

## Task 2: Golden loop + reject + revision (`e2e/loop.spec.ts`)

**Files:** Create `e2e/loop.spec.ts`.

The golden test switches actors via per-role contexts. It posts a uniquely-titled idea so reruns
don't collide, threads the idea id through the URL, and asserts the verify→payout moment.

- [ ] **Step 1: Write `e2e/loop.spec.ts`**:

```ts
import { test, expect, type BrowserContext, type Browser } from '@playwright/test';
import { ROLES } from './auth';

async function ctx(browser: Browser, state: string): Promise<BrowserContext> {
  return browser.newContext({ storageState: state });
}

test('golden loop: post → fund → answer → verify (payout moment) → admin approve', async ({ browser }) => {
  const title = `E2E Bounty ${crypto.randomUUID().slice(0, 8)}`;
  const answerTitle = `E2E Answer ${crypto.randomUUID().slice(0, 8)}`;

  // ── expert posts an idea ──
  const expert = await ctx(browser, ROLES.expert.state);
  const ep = await expert.newPage();
  await ep.goto('/console');
  await ep.getByPlaceholder('Title').fill(title);
  await ep.getByRole('button', { name: 'Publish' }).click();
  await ep.waitForURL(/\/ideas\/[0-9a-f-]+$/);
  const ideaUrl = new URL(ep.url()).pathname;            // /ideas/<uuid>
  await expect(ep.getByRole('heading', { name: title })).toBeVisible();

  // ── funder pledges ──
  const funder = await ctx(browser, ROLES.funder.state);
  const fp = await funder.newPage();
  await fp.goto(ideaUrl);
  await fp.getByLabel('Fund this idea ($)').fill('50');
  await fp.getByRole('button', { name: 'Pledge' }).click();
  await expect(fp.getByText(/\$50\.00/)).toBeVisible();   // funders list / meter reflects it

  // ── submitter submits an answer ──
  const submitter = await ctx(browser, ROLES.submitter.state);
  const sp = await submitter.newPage();
  await sp.goto(ideaUrl);
  await sp.getByRole('link', { name: 'Submit an answer' }).click();
  await sp.getByPlaceholder('Answer title').fill(answerTitle);
  await sp.locator('textarea[name=explanation_md]').fill('Our result with evidence.');
  await sp.locator('textarea[name=artifacts]').fill('https://github.com/example/repo');
  await sp.getByRole('button', { name: 'Submit' }).click();
  await sp.waitForURL(new RegExp(ideaUrl.replace(/[/]/g, '\\/') + '$'));
  await expect(sp.getByText(answerTitle)).toBeVisible();

  // ── author verifies with a payout → the verify→payout moment ──
  const ap = await expert.newPage();
  await ap.goto('/console');
  const row = ap.locator('div', { hasText: answerTitle }).filter({ has: ap.getByRole('button', { name: 'Verify' }) }).first();
  await row.getByLabel('Intended payout ($)').fill('120');
  await row.getByRole('button', { name: 'Verify' }).click();
  // the verify→payout moment is held ~700ms before the row refetches away — assert it within that
  // window, scoped to this answer's card (Playwright auto-waits, no manual timeout).
  const verifiedCard = ap.locator('.rounded-2xl', { hasText: answerTitle });
  await expect(verifiedCard.getByText('Verified')).toBeVisible();
  await expect(verifiedCard.getByText(/\$120\.00/)).toBeVisible();

  // ── admin approves the charitable gate ──
  const admin = await ctx(browser, ROLES.admin.state);
  const adp = await admin.newPage();
  await adp.goto('/admin/payouts');
  const prow = adp.locator('tr', { hasText: title });
  await expect(prow.getByText(/\$120\.00/)).toBeVisible();   // intended payout recorded
  await prow.getByRole('button', { name: 'Approve' }).click();
  await expect(adp.getByText('Approved', { exact: false })).toBeVisible();

  // ── final state: the verified answer + intended payout shows on the idea page ──
  await fp.goto(ideaUrl);
  await expect(fp.getByText(answerTitle)).toBeVisible();
  await expect(fp.getByText(/Intended payout/)).toBeVisible();

  for (const c of [expert, funder, submitter, admin]) await c.close();
});

test('reject path: author rejects an answer → it ends rejected', async ({ browser }) => {
  const title = `E2E Reject ${crypto.randomUUID().slice(0, 8)}`;
  const answerTitle = `E2E RejAns ${crypto.randomUUID().slice(0, 8)}`;
  const expert = await ctx(browser, ROLES.expert.state);
  const ep = await expert.newPage();
  await ep.goto('/console');
  await ep.getByPlaceholder('Title').fill(title);
  await ep.getByRole('button', { name: 'Publish' }).click();
  await ep.waitForURL(/\/ideas\/[0-9a-f-]+$/);
  const ideaUrl = new URL(ep.url()).pathname;

  const submitter = await ctx(browser, ROLES.submitter.state);
  const sp = await submitter.newPage();
  await sp.goto(ideaUrl + '/answer');
  await sp.getByPlaceholder('Answer title').fill(answerTitle);
  await sp.locator('textarea[name=explanation_md]').fill('Attempt.');
  await sp.getByRole('button', { name: 'Submit' }).click();

  const ap = await expert.newPage();
  await ap.goto('/console');
  const row = ap.locator('div', { hasText: answerTitle }).filter({ has: ap.getByRole('button', { name: 'Reject' }) }).first();
  await row.getByRole('button', { name: 'Reject' }).click();
  await ap.waitForLoadState('networkidle');
  // after the refetch the rejected answer is no longer in the review queue
  await expect(ap.getByText(answerTitle)).toHaveCount(0);

  await expert.close(); await submitter.close();
});

test('revision path: request_revision keeps the answer in the queue', async ({ browser }) => {
  const title = `E2E Rev ${crypto.randomUUID().slice(0, 8)}`;
  const answerTitle = `E2E RevAns ${crypto.randomUUID().slice(0, 8)}`;
  const expert = await ctx(browser, ROLES.expert.state);
  const ep = await expert.newPage();
  await ep.goto('/console');
  await ep.getByPlaceholder('Title').fill(title);
  await ep.getByRole('button', { name: 'Publish' }).click();
  await ep.waitForURL(/\/ideas\/[0-9a-f-]+$/);
  const ideaUrl = new URL(ep.url()).pathname;

  const submitter = await ctx(browser, ROLES.submitter.state);
  const sp = await submitter.newPage();
  await sp.goto(ideaUrl + '/answer');
  await sp.getByPlaceholder('Answer title').fill(answerTitle);
  await sp.locator('textarea[name=explanation_md]').fill('Draft.');
  await sp.getByRole('button', { name: 'Submit' }).click();

  const ap = await expert.newPage();
  await ap.goto('/console');
  const row = ap.locator('div', { hasText: answerTitle }).filter({ has: ap.getByRole('button', { name: 'Request revision' }) }).first();
  await row.getByPlaceholder('What to revise').fill('Add detail.');
  await row.getByRole('button', { name: 'Request revision' }).click();
  await ap.waitForLoadState('networkidle');
  // revision_requested stays in the queue (in-place feedback)
  await expect(ap.getByText(answerTitle)).toBeVisible();

  await expert.close(); await submitter.close();
});
```

> Implementer note: the row locators use `hasText: answerTitle` + filter-by-button to scope to the
> right card. If the `div`-with-hasText matches too broadly (nested divs), narrow to the card
> wrapper class `.rounded-2xl` (e.g. `ap.locator('.rounded-2xl', { hasText: answerTitle })`).
> The exact funded-amount `$50.00` text appears in the Funders list (the funder is named); if the
> funder has no display_name it shows the handle — assert the BountyMeter total instead if needed.
> Adjust selectors to what actually renders; the assertions (idea posted, pledge reflected, answer
> visible, Verified+amount shown, Approved shown) are the contract.

- [ ] **Step 2: Run** `npm run test:e2e -- e2e/loop.spec.ts` → 3 pass. Debug selectors against the real render (use `--headed`/`--debug` or `npx playwright test --ui` locally) until green; do not weaken the contract assertions.
- [ ] **Step 3: Commit** `git add e2e/loop.spec.ts && git commit -m "test(e2e): golden 4-role loop (verify→payout moment) + reject + revision"`

---

## Task 3: Guards + dashboard (`e2e/guards.spec.ts`, `e2e/dashboard.spec.ts`)

**Files:** Create `e2e/guards.spec.ts`, `e2e/dashboard.spec.ts`.

- [ ] **Step 1: Write `e2e/guards.spec.ts`**:

```ts
import { test, expect } from '@playwright/test';
import { ROLES } from './auth';

test.describe('authed-but-unauthorized', () => {
  test.use({ storageState: ROLES.funder.state });

  test('a member is redirected from /console', async ({ page }) => {
    await page.goto('/console');
    await expect(page).toHaveURL(/\/login/);
  });
  test('a member is redirected from /admin/experts', async ({ page }) => {
    await page.goto('/admin/experts');
    await expect(page).toHaveURL(/\/login/);
  });
  test('a member is redirected from /admin/payouts', async ({ page }) => {
    await page.goto('/admin/payouts');
    await expect(page).toHaveURL(/\/login/);
  });
});

test("a second expert does not see another expert's answers in their review queue", async ({ browser }) => {
  // expert posts an idea; submitter answers it
  const title = `E2E Iso ${crypto.randomUUID().slice(0, 8)}`;
  const answerTitle = `E2E IsoAns ${crypto.randomUUID().slice(0, 8)}`;
  const expert = await browser.newContext({ storageState: ROLES.expert.state });
  const ep = await expert.newPage();
  await ep.goto('/console');
  await ep.getByPlaceholder('Title').fill(title);
  await ep.getByRole('button', { name: 'Publish' }).click();
  await ep.waitForURL(/\/ideas\/[0-9a-f-]+$/);
  const ideaUrl = new URL(ep.url()).pathname;

  const submitter = await browser.newContext({ storageState: ROLES.submitter.state });
  const sp = await submitter.newPage();
  await sp.goto(ideaUrl + '/answer');
  await sp.getByPlaceholder('Answer title').fill(answerTitle);
  await sp.locator('textarea[name=explanation_md]').fill('x');
  await sp.getByRole('button', { name: 'Submit' }).click();

  // expert2 must NOT see that answer in their own console queue
  const expert2 = await browser.newContext({ storageState: ROLES.expert2.state });
  const e2p = await expert2.newPage();
  await e2p.goto('/console');
  await expect(e2p.getByText(answerTitle)).toHaveCount(0);

  await expert.close(); await submitter.close(); await expert2.close();
});
```

- [ ] **Step 2: Write `e2e/dashboard.spec.ts`**:

```ts
import { test, expect } from '@playwright/test';
import { ROLES } from './auth';

test('funder dashboard reflects a pledge and a followed expert', async ({ browser }) => {
  const title = `E2E Dash ${crypto.randomUUID().slice(0, 8)}`;

  // expert posts an idea
  const expert = await browser.newContext({ storageState: ROLES.expert.state });
  const ep = await expert.newPage();
  await ep.goto('/console');
  await ep.getByPlaceholder('Title').fill(title);
  await ep.getByRole('button', { name: 'Publish' }).click();
  await ep.waitForURL(/\/ideas\/[0-9a-f-]+$/);
  const ideaUrl = new URL(ep.url()).pathname;

  // funder pledges, then follows the expert via Discover
  const funder = await browser.newContext({ storageState: ROLES.funder.state });
  const fp = await funder.newPage();
  await fp.goto(ideaUrl);
  await fp.getByLabel('Fund this idea ($)').fill('25');
  await fp.getByRole('button', { name: 'Pledge' }).click();
  await fp.goto('/dashboard?tab=discover');
  const follow = fp.getByRole('button', { name: 'Follow' }).first();
  if (await follow.count()) await follow.click();

  // My funding shows the committed total
  await fp.goto('/dashboard');
  await expect(fp.getByText('My funding')).toBeVisible();
  await expect(fp.getByText(/Total committed/)).toBeVisible();
  await expect(fp.getByText(/\$25\.00/)).toBeVisible();

  await expert.close(); await funder.close();
});
```

- [ ] **Step 3: Run** `npm run test:e2e -- e2e/guards.spec.ts e2e/dashboard.spec.ts` → all pass; adjust selectors to the real render without weakening the assertions.
- [ ] **Step 4: Run the FULL suite** `npm run test:e2e` → all green (existing 11 smoke + new authed tests). `npm run check` → 0 errors (the e2e `.ts` files type-check).
- [ ] **Step 5: Commit** `git add e2e/guards.spec.ts e2e/dashboard.spec.ts && git commit -m "test(e2e): authed-but-unauthorized + non-author isolation + funder dashboard"`

---

## Task 4: CI job

**Files:** Modify `.github/workflows/ci.yml`.

- [ ] **Step 1: Add an `e2e` job** to `.github/workflows/ci.yml` (alongside `app` and `db`):

```yaml
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - uses: supabase/setup-cli@v1
        with: { version: 2.75.0 }
      - run: supabase start                       # local stack + migrations
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
        env:
          CI: 'true'
          PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
          PUBLIC_SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
      - if: failure()
        uses: actions/upload-artifact@v4
        with: { name: playwright-report, path: playwright-report/, retention-days: 7 }
```

(The DB container name on the runner is also `supabase_db_<projectId>` = `supabase_db_aisafetyideas`,
matching `global-setup.ts`'s `docker exec`. `webServer.reuseExistingServer:!CI` means CI always
boots a fresh preview. Chromium-only for speed.)

- [ ] **Step 2: Verify the YAML parses** — `npx --yes js-yaml .github/workflows/ci.yml >/dev/null` (or any YAML check) → no error. (CI itself proves it on push.)
- [ ] **Step 3: Commit** `git add .github/workflows/ci.yml && git commit -m "ci: run authed Playwright E2E suite (local stack + chromium)"`

---

## Task 5: Final verification
- [ ] Local: with the stack up, `npm run test:e2e` → entire suite green (smoke + golden loop + guards + dashboard); `e2e/.auth/*.json` are gitignored (not staged).
- [ ] `npm run check` → 0 errors; `npx vitest run` → unaffected/green; `supabase test db` → unchanged-green (no SQL touched outside `e2e/fixtures`).
- [ ] Dispatch the final holistic review; finish the branch (PR). The PR push triggers the new CI `e2e` job — confirm it goes green there too.

## Done-when
- Global-setup creates the 5 role users (anon signUp) + roles (SQL) + mints 5 `storageState`s with **no service-role key**; verifies each authenticates.
- The golden 4-role loop passes through the UI and asserts the verify→payout moment (Verified seal + counted amount) and the recorded intended payout at the admin gate; reject + revision paths pass.
- Guards (member→/console,/admin redirect; non-author can't see another's queue) + funder dashboard pass.
- Reduced-motion forced; tests self-contained (unique titles); CI `e2e` job green.
- No app/RPC/DB/migration changes; existing 11 smoke specs still pass.
