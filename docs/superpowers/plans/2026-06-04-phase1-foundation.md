# AI Safety Ideas — Phase 1 · Plan 1: Foundation & Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a deployable SvelteKit 2 + Svelte 5 app on the `rebuild-2026` branch with Supabase v2 (local + a new cloud project), the `CLAUDE.md` design tokens, SSR cookie auth via `@supabase/ssr` (Google + email magic-link), a `profiles`/`experts`/`follows` schema under full RLS, pgTAP RLS tests, and CI — ending at: a user can sign in and see/edit their profile.

**Architecture:** SvelteKit App Router with server-side data loading; Supabase Postgres is the source of truth with **RLS on every table** and roles derived from the DB (never `user_metadata`). Auth runs server-side through `@supabase/ssr` cookies validated with `getUser()`. The global design system lives in `app.css` (never in a component). Schema is **payment-complete by Phase 2** but this plan only creates identity tables.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), TypeScript, Tailwind CSS v4, Supabase (Postgres 15+, `supabase-js` v2, `@supabase/ssr`), Vitest, Playwright, Supabase CLI (pgTAP), `@sveltejs/adapter-vercel`, GitHub Actions.

---

## Phase 1 plan roadmap (this plan is #1 of 5)

Each plan ships working, testable software; later plans are authored just-in-time after the prior milestone lands.

1. **Foundation & Auth** *(this document)* — scaffold, design tokens, Supabase, SSR auth, `profiles`/`experts`/`follows`, RLS, CI.
2. **Ideas & Experts** — `ideas` (hypothesis/open_ended) + `categories` + `idea_categories` + `idea_relations`; admin expert-vetting; public browse + idea detail (server-paginated); expert console post/edit; RLS + tests.
3. **Answers & Verification** — `answers` + `answer_artifacts` + `answer_reviews`; submit flow; author verify / request-revision / reject; **admin charitable-purpose gate** recording *intended* `payouts` (money OFF); `auto_resolve_days` escalation; RLS + tests.
4. **Funding pledges & Dashboards** — `idea_funding` (pledge/`committed`, no ledger) + `bounty_pot` view; funder follows + dashboard (followed feed, all-experts fallback, persistent Discover tab); create the full ledger/`donations`/`payouts`/`withdrawals` tables **flagged off**; RLS + tests.
5. **Social & Polish** — `comments` + `interest`; signature interactions from `CLAUDE.md` (card-morph, verify→payout motion); a11y/reduced-motion pass; full E2E of the money-off core loop; production deploy.

---

## File structure (Plan 1)

| File | Responsibility |
|---|---|
| `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json` | Project + build config (adapter-vercel) |
| `src/app.css` | Global design tokens (colors, type, radius, shadow, motion) from `CLAUDE.md` + Tailwind v4 `@theme` |
| `src/lib/motion.ts` | JS spring/duration presets (single source of truth) |
| `src/app.html`, `src/app.d.ts` | HTML shell; typed `App.Locals`/`PageData` |
| `src/hooks.server.ts` | Per-request Supabase server client, `safeGetSession` (getUser-validated), route guards |
| `src/lib/types/database.ts` | Generated DB types (`supabase gen types`) |
| `supabase/config.toml`, `supabase/migrations/0001_identity.sql`, `supabase/seed.sql` | Local stack + identity schema + RLS + seed |
| `supabase/tests/database/identity_test.sql` | pgTAP RLS tests |
| `src/routes/+layout.server.ts`, `+layout.ts`, `+layout.svelte`, `+error.svelte` | Session wiring + app shell + error page |
| `src/routes/+page.svelte` | Placeholder landing |
| `src/routes/login/+page.svelte`, `+page.server.ts` | Sign-in (Google + email magic-link) |
| `src/routes/auth/callback/+server.ts`, `src/routes/auth/error/+page.svelte` | OAuth/OTP code exchange |
| `src/routes/logout/+page.server.ts` | Sign-out action |
| `src/routes/u/[handle]/+page.server.ts`, `+page.svelte` | Profile view + self-edit |
| `e2e/auth.spec.ts` | Playwright auth smoke test |
| `.github/workflows/ci.yml` | build · typecheck · unit · db lint/test |
| `.env.example`, `README.md` | Env contract + run docs |

---

## Task 1: Scaffold the SvelteKit 2 + Svelte 5 app

**Files:**
- Create: project skeleton (`package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `src/app.html`, `src/routes/+page.svelte`)

> The current repo root holds the legacy Svelte-3 app. We build the new app in-place on `rebuild-2026`; the old `src/` is replaced. Confirm you are on `rebuild-2026` (`git branch --show-current`).

- [ ] **Step 1: Archive the legacy app and clear the old source**

```bash
git mv src src_legacy_v0           # keep old code for reference during the rebuild
git mv package.json package.legacy.json
git mv svelte.config.js svelte.config.legacy.js
git mv jsconfig.json jsconfig.legacy.json 2>/dev/null || true
git commit -m "chore: archive legacy v0 app under *_legacy*"
```

- [ ] **Step 2: Scaffold a fresh SvelteKit app into the repo root**

Run (non-interactive; `sv` is the current SvelteKit scaffolder):
```bash
npx sv@latest create . --template minimal --types ts --no-add-ons --no-install
```
If it refuses on a non-empty dir, scaffold in a temp dir and move files:
```bash
npx sv@latest create .sk-tmp --template minimal --types ts --no-add-ons --no-install \
  && cp -R .sk-tmp/. . && rm -rf .sk-tmp
```

- [ ] **Step 3: Install runtime + dev dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D @sveltejs/adapter-vercel tailwindcss @tailwindcss/vite \
  vitest @testing-library/svelte jsdom \
  @playwright/test svelte-check typescript
npx playwright install --with-deps chromium
```

- [ ] **Step 4: Point the adapter at Vercel**

Edit `svelte.config.js`:
```js
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: { adapter: adapter() }
};
export default config;
```

- [ ] **Step 5: Verify the app builds and boots**

Run: `npm run build`
Expected: build completes with no errors.
Run: `npm run dev -- --port 5173 &` then `curl -sS localhost:5173 | head -n1` ; expect HTML; then `kill %1`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: scaffold SvelteKit 2 + Svelte 5 + Vercel adapter"
```

---

## Task 2: Design tokens (CLAUDE.md → app.css + motion.ts)

**Files:**
- Create: `src/app.css`, `src/lib/motion.ts`
- Modify: `vite.config.ts` (Tailwind v4 plugin), `src/routes/+layout.svelte` (import css — created in Task 7; for now create a temporary import in `+page.svelte`)

- [ ] **Step 1: Enable Tailwind v4 in Vite**

`vite.config.ts`:
```ts
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  test: { environment: 'jsdom', include: ['src/**/*.{test,spec}.{js,ts}'] }
});
```

- [ ] **Step 2: Write `src/app.css` with the brand + motion tokens** (greyscale UI, `#44ff98` accent-only — verbatim from `CLAUDE.md`)

```css
@import 'tailwindcss';

:root {
  /* Structure & text: greyscale only */
  --ink:#1a1d1b; --ink-2:#252525; --body:#3a3f3d; --muted:#6b7280; --faint:#a0a0a0;
  --line:rgba(20,24,22,.08); --line-strong:rgba(20,24,22,.14);
  --canvas:#f5f6f5; --surface:#fff; --surface-2:#fafbfa; --surface-dk:#1a1d1b; --on-dark:#f5f6f5;
  /* Brand green: accent only */
  --green:#44ff98; --green-bright:#60ff7b; --green-deep:#1cdb72;
  /* Semantic */
  --pos:#1cdb72; --neg:#ff375e; --warn:#ff9307; --info:#0a84ff;
  /* Radius / shadow */
  --r-pill:999px; --r-card:16px; --r-ctrl:12px; --r-chip:10px;
  --shadow-1:0 1px 2px rgba(20,24,22,.04),0 1px 1px rgba(20,24,22,.03);
  --shadow-2:0 2px 4px rgba(20,24,22,.04),0 4px 12px rgba(20,24,22,.06);
  --shadow-3:0 8px 24px rgba(20,24,22,.08),0 2px 6px rgba(20,24,22,.05);
  /* Motion */
  --dur-instant:80ms; --dur-fast:140ms; --dur-base:220ms; --dur-slow:360ms; --dur-slower:520ms;
  --ease-snappy:cubic-bezier(.2,0,0,1); --ease-out-soft:cubic-bezier(.16,1,.3,1);
  --ease-emphasized:cubic-bezier(.32,.72,0,1); --ease-in-out:cubic-bezier(.65,0,.35,1);
}

/* Expose a subset to Tailwind v4 utilities */
@theme {
  --color-ink:#1a1d1b; --color-muted:#6b7280; --color-canvas:#f5f6f5; --color-surface:#fff;
  --color-green:#44ff98; --color-green-deep:#1cdb72; --color-pos:#1cdb72; --color-neg:#ff375e;
  --font-display:"Sora",sans-serif; --font-serif:"Lora",serif;
  --radius-card:16px; --radius-ctrl:12px;
}

html { font-family: var(--font-display); color: var(--body); background: var(--canvas); }
*, *::before, *::after { box-sizing: border-box; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration:.01ms !important; animation-iteration-count:1 !important;
    transition-duration:.01ms !important; scroll-behavior:auto !important;
  }
}
```

- [ ] **Step 3: Write `src/lib/motion.ts`** (verbatim from `CLAUDE.md` §8)

```ts
export const spring = {
  snappy: { stiffness: 420, damping: 34, mass: 1 },
  smooth: { stiffness: 260, damping: 30, mass: 1 },
  gentle: { stiffness: 160, damping: 26, mass: 1 }
} as const;
export const dur = { instant: .08, fast: .14, base: .22, slow: .36, slower: .52 } as const;
```

- [ ] **Step 4: Import the css from the root page (temporary until Task 7 layout)**

In `src/routes/+page.svelte`:
```svelte
<script lang="ts">
  import '../app.css';
</script>
<main class="mx-auto max-w-3xl p-12">
  <h1 class="text-3xl font-bold" style="color:var(--ink)">AI Safety Ideas</h1>
  <p style="color:var(--muted)">Rebuild in progress.</p>
</main>
```

- [ ] **Step 5: Verify tokens render**

Run: `npm run dev -- --port 5173 &` ; `curl -sS localhost:5173 | grep -q "AI Safety Ideas" && echo OK` ; `kill %1`
Expected: `OK`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: design tokens (app.css) + motion presets per CLAUDE.md"
```

---

## Task 3: Supabase — local stack + new cloud project + env

**Files:**
- Create: `supabase/config.toml` (via CLI), `.env.example`, `.env.local` (gitignored)

> Creating the cloud project is a real, billable action in the **Apart Research** org. Do it with the owner's explicit go-ahead; the local stack needs no cloud.

- [ ] **Step 1: Initialize the local Supabase project**

```bash
supabase init
supabase start          # boots local Postgres + Auth + Studio
```
Expected: prints local `API URL` (`http://127.0.0.1:54321`) and `anon key`.

- [ ] **Step 2: Create the cloud project (owner go-ahead required)**

```bash
supabase projects create "AI Safety Ideas 2026" --org-id <APART_ORG_ID> --region us-east-1 --db-password "<generated>"
```
(Org id is the *Apart Research* org. Capture the new project ref.) Then link:
```bash
supabase link --project-ref <NEW_REF>
```

- [ ] **Step 3: Write `.env.example` and a gitignored `.env.local`**

`.env.example`:
```
PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only, never PUBLIC_>
```
Ensure `.gitignore` contains `.env`, `.env.*`, `!.env.example`.

- [ ] **Step 4: Verify env loads**

Run: `grep -q PUBLIC_SUPABASE_URL .env.example && echo OK`
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml .env.example .gitignore && git commit -m "chore: supabase local stack + env contract"
```

---

## Task 4: Migration 0001 — identity schema + RLS + signup trigger

**Files:**
- Create: `supabase/migrations/0001_identity.sql`

- [ ] **Step 1: Create the migration file**

```bash
supabase migration new identity
# rename/replace the generated file's contents with the SQL below
```

- [ ] **Step 2: Write the full schema + RLS** into `supabase/migrations/0001_identity.sql`

```sql
-- ============ profiles (1:1 with auth.users; NO email column — email stays in auth.users) ============
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  handle       text unique not null,
  display_name text,
  avatar_url   text,
  bio_md       text,
  career_stage text,
  links        jsonb not null default '{}'::jsonb,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles are readable by everyone"
  on public.profiles for select using (true);
create policy "users insert own profile"
  on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "users update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- admin check as SECURITY DEFINER to avoid RLS recursion; locked search_path
create or replace function public.is_admin()
  returns boolean language sql security definer set search_path = '' stable as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ============ experts (vetted creator roster) ============
create table public.experts (
  id          uuid primary key references public.profiles(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending','approved','revoked')),
  specialty   text,
  featured    boolean not null default false,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.experts enable row level security;

create policy "experts readable by everyone"
  on public.experts for select using (true);
create policy "users apply as expert (pending only)"
  on public.experts for insert to authenticated
  with check ((select auth.uid()) = id and status = 'pending');
create policy "admins manage experts"
  on public.experts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============ follows (funder dashboard) ============
create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  expert_id   uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, expert_id)
);
alter table public.follows enable row level security;

create policy "follows readable by everyone"
  on public.follows for select using (true);
create policy "users manage own follows"
  on public.follows for all to authenticated
  using ((select auth.uid()) = follower_id) with check ((select auth.uid()) = follower_id);

-- ============ signup trigger: create a profile row for each new auth user ============
create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer set search_path = '' as $$
declare base_handle text;
begin
  base_handle := regexp_replace(lower(split_part(coalesce(new.email,'user'), '@', 1)), '[^a-z0-9_]', '', 'g');
  insert into public.profiles (id, handle, display_name, avatar_url)
  values (
    new.id,
    base_handle || '-' || substr(new.id::text, 1, 4),
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 3: Apply locally (use `db reset` so the trigger fires on a clean DB)**

Run: `supabase db reset`
Expected: migration `0001_identity` applies with no errors; trigger created.

- [ ] **Step 4: Smoke-check the schema**

Run:
```bash
supabase db query "select table_name from information_schema.tables where table_schema='public' order by 1"
```
Expected: lists `experts`, `follows`, `profiles`.
> If your CLI is < 2.79.0, use the MCP `execute_sql` tool or `psql "$(supabase status -o env | grep DB_URL | cut -d= -f2)"` instead.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_identity.sql && git commit -m "feat(db): identity schema (profiles/experts/follows) + RLS + signup trigger"
```

---

## Task 5: pgTAP RLS tests for the identity schema

**Files:**
- Create: `supabase/tests/database/identity_test.sql`

- [ ] **Step 1: Write the failing RLS test**

`supabase/tests/database/identity_test.sql`:
```sql
begin;
select plan(6);

-- seed two users directly in auth.users (trigger creates their profiles).
-- Include the columns local Supabase auth.users requires (no defaults) to avoid NOT NULL errors.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','alice@example.com','x', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','bob@example.com','x', now(), now(), now());

-- 1) anon CAN read profiles
set local role anon;
select ok( (select count(*) from public.profiles) = 2, 'anon can read all profiles' );

-- 2) anon CANNOT insert a profile
-- RLS-denied INSERT raises 42501; match on the error CODE only (message wording varies)
select throws_ok(
  $$ insert into public.profiles(id, handle) values ('33333333-3333-3333-3333-333333333333','x') $$,
  '42501', null, 'anon cannot insert profile'
);

-- act as alice
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- 3) alice CAN update her own profile
update public.profiles set display_name = 'Alice' where id = '11111111-1111-1111-1111-111111111111';
select ok(
  (select display_name from public.profiles where id='11111111-1111-1111-1111-111111111111') = 'Alice',
  'user updates own profile'
);

-- 4) alice CANNOT update bob's profile (0 rows changed, no error)
update public.profiles set display_name = 'hacked' where id = '22222222-2222-2222-2222-222222222222';
select is(
  (select display_name from public.profiles where id='22222222-2222-2222-2222-222222222222'), null,
  'user cannot update another profile'
);

-- 5) alice CAN apply as a pending expert
insert into public.experts(id, status) values ('11111111-1111-1111-1111-111111111111','pending');
select ok( (select status from public.experts where id='11111111-1111-1111-1111-111111111111')='pending',
  'user can apply as pending expert' );

-- 6) alice CANNOT self-approve: there is no UPDATE policy for non-admins, so the row is
--    invisible to UPDATE → 0 rows changed, NO error (RLS denies UPDATE silently). Assert unchanged.
update public.experts set status='approved' where id='11111111-1111-1111-1111-111111111111';
select is(
  (select status from public.experts where id='11111111-1111-1111-1111-111111111111'), 'pending',
  'non-admin cannot approve expert (update silently affects 0 rows)'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test — expect FAIL if any policy is wrong**

Run: `supabase test db`
Expected on a correct migration: all 6 assertions PASS. If a policy is missing, the corresponding assertion FAILs — fix the migration (Task 4) and re-run.
> CLI < 2.81 for advisors: skip advisors here; `supabase test db` (pgTAP) is available from 2.x.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/database/identity_test.sql && git commit -m "test(db): pgTAP RLS tests for identity schema"
```

---

## Task 6: Supabase SSR clients, hooks, and generated types

**Files:**
- Create: `src/hooks.server.ts`, `src/app.d.ts`, `src/lib/types/database.ts`

- [ ] **Step 1: Generate DB types**

Run: `supabase gen types typescript --local > src/lib/types/database.ts`
Expected: a `Database` type with `profiles`/`experts`/`follows`.

- [ ] **Step 2: Type `App.Locals` and `PageData`** in `src/app.d.ts`

```ts
import type { SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database';

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient<Database>;
      safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
      session: Session | null;
      user: User | null;
    }
    interface PageData { session: Session | null; user: User | null }
    // interface Error {}
    // interface Platform {}
  }
}
export {};
```

- [ ] **Step 3: Write `src/hooks.server.ts`** (server client + getUser-validated session + route guards)

```ts
import { createServerClient } from '@supabase/ssr';
import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

const supabase: Handle = async ({ event, resolve }) => {
  event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
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
    // ALWAYS validate the JWT with getUser() — never trust getSession alone
    const { data: { user }, error } = await event.locals.supabase.auth.getUser();
    if (error) return { session: null, user: null };
    return { session, user };
  };

  return resolve(event, {
    filterSerializedResponseHeaders: (name) =>
      name === 'content-range' || name === 'x-supabase-api-version'
  });
};

const PROTECTED = ['/dashboard', '/console', '/admin']; // NOT /u — profiles are public to view

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
```

- [ ] **Step 4: Typecheck**

Run: `npm run check` (svelte-check)
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks.server.ts src/app.d.ts src/lib/types/database.ts && git commit -m "feat(auth): @supabase/ssr server client + getUser-validated session + guards"
```

---

## Task 7: Session wiring, app shell, error page

**Files:**
- Create: `src/routes/+layout.server.ts`, `src/routes/+layout.ts`, `src/routes/+layout.svelte`, `src/routes/+error.svelte`
- Modify: `src/routes/+page.svelte` (remove the temporary css import — layout now owns it)

- [ ] **Step 1: `+layout.server.ts` — expose session + cookies**

```ts
import type { LayoutServerLoad } from './$types';
export const load: LayoutServerLoad = async ({ locals: { safeGetSession }, cookies }) => {
  const { session, user } = await safeGetSession();
  return { session, user, cookies: cookies.getAll() };
};
```

- [ ] **Step 2: `+layout.ts` — universal Supabase client**

```ts
import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data, depends, fetch }) => {
  depends('supabase:auth');
  const supabase = isBrowser()
    ? createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, { global: { fetch } })
    : createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
        global: { fetch },
        cookies: { getAll: () => data.cookies }
      });
  const { data: { session } } = await supabase.auth.getSession();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, session, user };
};
```

- [ ] **Step 3: `+layout.svelte` — shell + auth refresh (Svelte 5 runes)**

```svelte
<script lang="ts">
  import '../app.css';
  import { invalidate } from '$app/navigation';
  import { onMount } from 'svelte';
  let { data, children } = $props();
  let supabase = $derived(data.supabase);

  onMount(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, newSession) => {
      if (newSession?.expires_at !== data.session?.expires_at) invalidate('supabase:auth');
    });
    return () => subscription.unsubscribe();
  });
</script>

<header class="flex items-center justify-between border-b px-6 py-3"
        style="border-color:var(--line)">
  <a href="/" class="font-bold" style="color:var(--ink)">AI Safety Ideas</a>
  <nav class="flex gap-4" style="color:var(--muted)">
    {#if data.user}
      <a href="/dashboard">Dashboard</a>
      <form method="POST" action="/logout"><button type="submit">Sign out</button></form>
    {:else}
      <a href="/login">Sign in</a>
    {/if}
  </nav>
</header>

<main class="mx-auto max-w-5xl p-6">{@render children()}</main>
```

- [ ] **Step 4: `+error.svelte` — real error page (old app had none)**

```svelte
<script lang="ts">
  import { page } from '$app/state';
</script>
<section class="mx-auto max-w-xl p-12 text-center">
  <h1 class="text-4xl font-bold" style="color:var(--ink)">{page.status}</h1>
  <p style="color:var(--muted)">{page.error?.message ?? 'Something went wrong.'}</p>
  <a href="/" class="mt-4 inline-block" style="color:var(--green-deep)">← Home</a>
</section>
```

- [ ] **Step 5: Trim the temp import from `+page.svelte`**

Remove the `import '../app.css'` line from `src/routes/+page.svelte` (the layout imports it now).

- [ ] **Step 6: Verify build + boot**

Run: `npm run build` (expect success), then `npm run check` (expect no errors).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: session wiring, app shell, and error page"
```

---

## Task 8: Sign-in (Google + email magic-link), callback, sign-out + E2E

**Files:**
- Create: `src/routes/login/+page.svelte`, `src/routes/login/+page.server.ts`, `src/routes/auth/callback/+server.ts`, `src/routes/auth/error/+page.svelte`, `src/routes/logout/+page.server.ts`, `e2e/auth.spec.ts`
- Modify: `playwright.config.ts` (created by scaffold or add)

- [ ] **Step 1: `login/+page.server.ts` — actions for OAuth + magic link**

```ts
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
```

- [ ] **Step 2: `login/+page.svelte`**

```svelte
<script lang="ts">
  let { form } = $props();
</script>
<section class="mx-auto max-w-sm p-8">
  <h1 class="mb-6 text-2xl font-bold" style="color:var(--ink)">Sign in</h1>
  <form method="POST" action="?/google" class="mb-4">
    <button class="w-full rounded-xl border py-2" style="border-color:var(--line)">Continue with Google</button>
  </form>
  <form method="POST" action="?/magiclink" class="flex flex-col gap-2">
    <input name="email" type="email" required placeholder="you@email.com"
           class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
    <button class="rounded-xl py-2 font-medium" style="background:var(--ink);color:#fff">Email me a link</button>
  </form>
  {#if form?.sent}<p class="mt-3" style="color:var(--green-deep)">Check your email for the link.</p>{/if}
  {#if form?.message}<p class="mt-3" style="color:var(--neg)">{form.message}</p>{/if}
</section>
```

- [ ] **Step 3: `auth/callback/+server.ts` — exchange code for a session**

```ts
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(303, next);
  }
  redirect(303, '/auth/error');
};
```

- [ ] **Step 4: `auth/error/+page.svelte`**

```svelte
<section class="mx-auto max-w-sm p-12 text-center">
  <h1 class="text-2xl font-bold" style="color:var(--ink)">Sign-in failed</h1>
  <a href="/login" style="color:var(--green-deep)">Try again</a>
</section>
```

- [ ] **Step 5: `logout/+page.server.ts`**

```ts
import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
export const actions: Actions = {
  default: async ({ locals: { supabase } }) => {
    await supabase.auth.signOut();
    redirect(303, '/');
  }
};
```

- [ ] **Step 6: Write the Playwright auth smoke test** `e2e/auth.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test('unauthenticated user is redirected from /dashboard to /login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('login page renders both auth options', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByPlaceholder('you@email.com')).toBeVisible();
});
```

- [ ] **Step 7: Ensure `playwright.config.ts` boots the dev server**

```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  webServer: { command: 'npm run build && npm run preview', port: 4173, reuseExistingServer: !process.env.CI },
  use: { baseURL: 'http://localhost:4173' },
  testDir: 'e2e'
});
```

- [ ] **Step 8: Run E2E — expect PASS**

Run: `npx playwright test`
Expected: both tests PASS (redirect guard works; login renders).

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(auth): Google + magic-link sign-in, callback, logout + E2E"
```

---

## Task 9: Profile page (view + self-edit)

**Files:**
- Create: `src/routes/u/[handle]/+page.server.ts`, `src/routes/u/[handle]/+page.svelte`

- [ ] **Step 1: `+page.server.ts` — load by handle + self-edit action (RLS does the auth)**

```ts
import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, handle, display_name, avatar_url, bio_md, career_stage')
    .eq('handle', params.handle)
    .single();
  if (!profile) error(404, 'Profile not found');
  return { profile };
};

export const actions: Actions = {
  update: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in required' });
    const fd = await request.formData();
    const { error: e } = await supabase
      .from('profiles')
      .update({
        display_name: String(fd.get('display_name') ?? ''),
        bio_md: String(fd.get('bio_md') ?? ''),
        career_stage: String(fd.get('career_stage') ?? '')
      })
      .eq('id', user.id);                 // RLS guarantees only own row is writable
    if (e) return fail(400, { message: e.message });
    return { saved: true };
  }
};
```

- [ ] **Step 2: `+page.svelte` — render + inline edit when it's your profile**

```svelte
<script lang="ts">
  let { data, form } = $props();
  let isSelf = $derived(data.user?.id === data.profile.id);
</script>
<article class="rounded-2xl border p-6" style="border-color:var(--line);background:var(--surface);box-shadow:var(--shadow-1)">
  <h1 class="text-2xl font-bold" style="color:var(--ink)">{data.profile.display_name ?? data.profile.handle}</h1>
  <p style="color:var(--faint)">@{data.profile.handle}{#if data.profile.career_stage} · {data.profile.career_stage}{/if}</p>
  <p class="mt-3" style="color:var(--body)">{data.profile.bio_md ?? ''}</p>

  {#if isSelf}
    <form method="POST" action="?/update" class="mt-6 flex flex-col gap-2">
      <input name="display_name" value={data.profile.display_name ?? ''} placeholder="Display name"
             class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
      <input name="career_stage" value={data.profile.career_stage ?? ''} placeholder="Career stage"
             class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
      <textarea name="bio_md" placeholder="Bio (markdown)"
             class="rounded-xl border px-3 py-2" style="border-color:var(--line)">{data.profile.bio_md ?? ''}</textarea>
      <button class="self-start rounded-xl px-4 py-2 font-medium" style="background:var(--ink);color:#fff">Save</button>
      {#if form?.saved}<span style="color:var(--green-deep)">Saved.</span>{/if}
      {#if form?.message}<span style="color:var(--neg)">{form.message}</span>{/if}
    </form>
  {/if}
</article>
```

- [ ] **Step 3: Write an integration test for the loader** `src/routes/u/[handle]/profile.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest';
import { load } from './+page.server';

function mkLocals(profile: unknown) {
  return {
    supabase: { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: profile }) }) }) }) },
    safeGetSession: async () => ({ session: null, user: null })
  } as any;
}

describe('profile load', () => {
  it('returns the profile when found', async () => {
    const profile = { id: 'p1', handle: 'alice', display_name: 'Alice' };
    const res = await load({ params: { handle: 'alice' }, locals: mkLocals(profile) } as any);
    expect(res.profile.handle).toBe('alice');
  });
  it('404s when not found', async () => {
    await expect(load({ params: { handle: 'nope' }, locals: mkLocals(null) } as any)).rejects.toMatchObject({ status: 404 });
  });
});
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `npx vitest run "src/routes/u/[handle]/profile.test.ts"` (quote the path — the shell would otherwise expand `[handle]`)
Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: profile page with RLS-backed self-edit + loader test"
```

---

## Task 10: CI pipeline + run docs

**Files:**
- Create: `.github/workflows/ci.yml`, `README.md`

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI
on: [push, pull_request]
jobs:
  app:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npm run check          # svelte-check / typecheck
      - run: npx vitest run         # unit/integration
      - run: npm run build          # build must pass
  db:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: supabase db start
      - run: supabase test db        # pgTAP RLS tests
      - run: supabase db lint         # static schema lint (advisors where CLI supports)
```

- [ ] **Step 2: Add the npm `check` script if missing** (`package.json` → `"check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json"`).

- [ ] **Step 3: Write `README.md`** with the run contract

```md
# AI Safety Ideas (2026 rebuild)
## Develop
1. `npm install`
2. `supabase start` then copy the local URL + anon key into `.env.local` (see `.env.example`)
3. `supabase db reset` (applies migrations + seed)
4. `npm run dev`
## Test
- `npx vitest run` · `supabase test db` · `npx playwright test`
See `docs/superpowers/specs/2026-06-04-aisafetyideas-overhaul-design.md` and `CLAUDE.md`.
```

- [ ] **Step 4: Verify the whole suite locally**

Run: `npm run check && npx vitest run && npm run build && supabase test db`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "ci: build/typecheck/test + db pgTAP/lint pipeline; run docs"
```

---

## Done-when (Plan 1 acceptance)
- `rebuild-2026` builds, typechecks, unit + pgTAP + Playwright suites pass in CI.
- A user can sign in (Google or magic-link); a `profiles` row is auto-created; they can view and edit **only their own** profile (enforced by RLS, proven by pgTAP).
- `experts`/`follows` exist with admin-gated/owner-gated RLS, ready for Plan 2.
- Design tokens + motion presets from `CLAUDE.md` are wired; no secret leaks (`PUBLIC_*` only on client; service-role server-only).

**Next:** author Plan 2 (Ideas & Experts) once this lands.
