# AI Safety Ideas - Phase 1 · Plan 2: Ideas & Experts - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the `ideas` domain (the two idea types) + `categories` + relations to the schema, plus expert-vetting and the first product surfaces (public browse, idea detail, expert console, admin expert-vetting) - all RLS-secured - on the `plan-2-ideas-experts` branch. Schema is designed to **absorb the old backup columns** (`legacy_id` + `legacy jsonb`) so the later one-big ETL is lossless.

**Architecture:** Builds on Plan 1 (SvelteKit 2 + Svelte 5 + Supabase v2 + `@supabase/ssr`, RLS-first, server-side `load()` + form actions → RLS). New tables reuse Plan 1's `experts`/`is_admin()`. Authorization is enforced in RLS (source of truth) and mirrored in UI gating. The expert-only "insert idea" check is **inlined** in the RLS policy (an `EXISTS` on `experts`), avoiding a new exposed SECURITY DEFINER RPC.

**Tech Stack:** unchanged from Plan 1.

**Cloud note (controller-handled, not a subagent task):** subagents develop + test against the **local** stack only. After the migrations are finalized and reviewed, the controller applies them to the cloud project `gjomchhbsbtauzkpyjwa` via the Supabase MCP (the repo CLI is on a different account). Subagents must NOT touch the cloud.

---

## Key design decisions (from the approved schema review)
- `ideas` is the clean new shape; old columns map in per the table below; anything without a first-class home rides in **`legacy jsonb`**; `legacy_id bigint unique` anchors the ETL.
- The "only approved experts post ideas" rule is an **RLS check on client inserts** (`EXISTS` on `experts`), not a hard FK - so the ETL can later insert old ideas (often non-expert authors) via service-role.
- `author_id` is `on delete set null` (an idea outlives a deleted author; the original author name also lives in `legacy`).
- FK columns get indexes now (`ideas.author_id`, `idea_categories.category_id`, `idea_relations.child_id`) - closing the Plan-1 deferral.

---

## File structure (Plan 2)

| File | Responsibility |
|---|---|
| `supabase/migrations/<ts>_harden_handle_new_user.sql` | Repo↔cloud parity: revoke EXECUTE on `handle_new_user` (already applied to cloud) |
| `supabase/migrations/<ts>_ideas.sql` | `categories`, `ideas`, `idea_categories`, `idea_relations` + RLS + indexes + `touch_updated_at` |
| `supabase/tests/database/ideas_test.sql` | pgTAP RLS tests for the ideas domain |
| `src/lib/types/database.ts` | Regenerated types |
| `src/lib/components/IdeaCard.svelte`, `StatusBadge.svelte` | Shared idea presentation |
| `src/routes/ideas/+page.server.ts` / `+page.svelte` | Public browse (filter by type/status/category, paginated) |
| `src/routes/ideas/[id]/+page.server.ts` / `+page.svelte` | Idea detail |
| `src/routes/console/+page.server.ts` / `+page.svelte` | Expert console (expert-gated): my ideas + new/edit idea form action |
| `src/routes/admin/experts/+page.server.ts` / `+page.svelte` | Admin expert-vetting (approve/revoke) |
| `src/routes/ideas/ideas.test.ts`, `e2e/ideas.spec.ts` | Loader unit tests + E2E |

---

## Task 1: Migrations - handle_new_user revoke + ideas schema

**Files:** `supabase/migrations/<ts>_harden_handle_new_user.sql`, `supabase/migrations/<ts>_ideas.sql`

- [ ] **Step 1: Create the housekeeping migration**

`supabase migration new harden_handle_new_user`, contents:
```sql
-- handle_new_user is a trigger-only function; it must not be callable as a REST RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
```

- [ ] **Step 2: Create the ideas-schema migration**

`supabase migration new ideas`, contents:
```sql
-- ============ categories ============
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  slug        text unique not null,
  title       text not null,
  description text,
  priority    integer not null default 100,
  created_at  timestamptz not null default now()
);
alter table public.categories enable row level security;
create policy "categories readable by everyone" on public.categories for select using (true);
create policy "admins manage categories" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============ ideas ============
create table public.ideas (
  id                uuid primary key default gen_random_uuid(),
  legacy_id         bigint unique,
  author_id         uuid references public.profiles(id) on delete set null,
  type              text not null default 'open_ended' check (type in ('hypothesis','open_ended')),
  title             text not null,
  summary_md        text,
  claim             text,
  status            text not null default 'draft' check (status in ('draft','open','resolved','closed','archived')),
  resolution        text check (resolution in ('yes','no','ambiguous')),
  estimated_hours   integer,
  importance        integer,
  source_url        text,
  from_date         date,
  contact           text,
  currency          text not null default 'USD',
  auto_resolve_days integer,
  closes_at         timestamptz,
  legacy            jsonb not null default '{}'::jsonb,   -- lossless catch-all for old columns
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.ideas enable row level security;
create index ideas_author_id_idx on public.ideas (author_id);
create index ideas_status_idx on public.ideas (status);

-- SELECT: public sees non-draft; authors see their own (incl. drafts); admins see all (policies OR together)
create policy "ideas readable when not draft" on public.ideas for select using (status <> 'draft');
create policy "authors read own ideas" on public.ideas for select to authenticated
  using ((select auth.uid()) = author_id);
create policy "admins read all ideas" on public.ideas for select to authenticated
  using (public.is_admin());
-- INSERT: an approved expert authoring their own idea (expert check inlined, no new RPC)
create policy "approved experts insert own ideas" on public.ideas for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and exists (select 1 from public.experts e
                where e.id = (select auth.uid()) and e.status = 'approved')
  );
-- UPDATE: author (own) or admin
create policy "authors update own ideas" on public.ideas for update to authenticated
  using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);
create policy "admins manage ideas" on public.ideas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- updated_at trigger (SECURITY INVOKER; not an RPC)
create or replace function public.touch_updated_at() returns trigger
  language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
create trigger ideas_touch_updated_at before update on public.ideas
  for each row execute function public.touch_updated_at();

-- ============ idea_categories (m:n) ============
create table public.idea_categories (
  idea_id     uuid not null references public.ideas(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (idea_id, category_id)
);
alter table public.idea_categories enable row level security;
create index idea_categories_category_id_idx on public.idea_categories (category_id);
create policy "idea_categories readable by everyone" on public.idea_categories for select using (true);
create policy "idea author or admin manage idea_categories" on public.idea_categories
  for all to authenticated
  using (exists (select 1 from public.ideas i where i.id = idea_id
                 and ((select auth.uid()) = i.author_id or public.is_admin())))
  with check (exists (select 1 from public.ideas i where i.id = idea_id
                 and ((select auth.uid()) = i.author_id or public.is_admin())));

-- ============ idea_relations (idea↔idea) ============
create table public.idea_relations (
  id         uuid primary key default gen_random_uuid(),
  legacy_id  bigint unique,
  parent_id  uuid not null references public.ideas(id) on delete cascade,
  child_id   uuid not null references public.ideas(id) on delete cascade,
  type       text,
  created_at timestamptz not null default now(),
  unique (parent_id, child_id)
);
alter table public.idea_relations enable row level security;
create index idea_relations_child_id_idx on public.idea_relations (child_id);
create policy "idea_relations readable by everyone" on public.idea_relations for select using (true);
create policy "parent author or admin manage idea_relations" on public.idea_relations
  for all to authenticated
  using (exists (select 1 from public.ideas i where i.id = parent_id
                 and ((select auth.uid()) = i.author_id or public.is_admin())))
  with check (exists (select 1 from public.ideas i where i.id = parent_id
                 and ((select auth.uid()) = i.author_id or public.is_admin())));
```

- [ ] **Step 3: Apply locally**

Run: `supabase db reset`
Expected: both new migrations apply with no errors.

- [ ] **Step 4: Smoke-check**

Run: `docker exec supabase_db_aisafetyideas psql -U postgres -d postgres -c "\dt public.*"`
Expected: includes `categories`, `ideas`, `idea_categories`, `idea_relations` (plus profiles/experts/follows).
Run: `docker exec supabase_db_aisafetyideas psql -U postgres -d postgres -c "select tablename, count(*) from pg_policies where schemaname='public' group by 1 order by 1;"`
Expected: ideas has 6 policies, categories 2, idea_categories 2, idea_relations 2.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): ideas/categories/relations schema + RLS (Plan 2) + handle_new_user revoke parity"
```

---

## Task 2: pgTAP RLS tests for the ideas domain

**Files:** `supabase/tests/database/ideas_test.sql`

- [ ] **Step 1: Write the test**

```sql
begin;
select plan(8);

-- two users: alice (will be approved expert), bob (regular)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','alice@example.com','x', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','bob@example.com','x', now(), now(), now());
-- alice is an approved expert
insert into public.experts (id, status) values ('11111111-1111-1111-1111-111111111111','approved');

-- act as alice (approved expert)
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- 1) approved expert can insert an idea authored by themselves (status 'open')
insert into public.ideas (id, author_id, type, title, status)
  values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','hypothesis','Test idea','open');
select ok((select count(*) from public.ideas) = 1, 'approved expert inserts own idea');

-- 2) expert cannot insert an idea authored by someone else (author_id check)
select throws_ok(
  $$ insert into public.ideas (author_id, title) values ('22222222-2222-2222-2222-222222222222','spoof') $$,
  '42501', null, 'cannot insert idea authored by another user');

-- act as bob (NOT an expert)
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

-- 3) non-expert cannot insert an idea (even authoring themselves)
select throws_ok(
  $$ insert into public.ideas (author_id, title) values ('22222222-2222-2222-2222-222222222222','bob idea') $$,
  '42501', null, 'non-expert cannot insert idea');

-- 4) bob (authed) can read alice's OPEN idea
select ok((select count(*) from public.ideas where status='open') = 1, 'open idea readable by other users');

-- 5) bob cannot update alice's OPEN idea: 0 rows, no error. Checked while OPEN so bob can still read it.
update public.ideas set title='hacked' where id='aaaaaaaa-0000-0000-0000-000000000001';
select is((select title from public.ideas where id='aaaaaaaa-0000-0000-0000-000000000001'),
  'Test idea', 'non-author cannot update idea');

-- 6) non-admin (bob) cannot insert a category
select throws_ok(
  $$ insert into public.categories (slug, title) values ('x','X') $$,
  '42501', null, 'non-admin cannot insert category');

-- alice drafts her idea
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
update public.ideas set status='draft' where id='aaaaaaaa-0000-0000-0000-000000000001';

-- 7) anon cannot see a draft idea
set local role anon;
select ok((select count(*) from public.ideas) = 0, 'anon cannot see draft ideas');

-- 8) the author CAN still see their own draft
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select ok((select count(*) from public.ideas) = 1, 'author sees own draft');

select * from finish();
rollback;
```

- [ ] **Step 2: Run**

Run: `supabase test db`
Expected: 8/8 pass. If a policy is wrong, fix the migration (Task 1) and re-run. Do NOT weaken RLS to pass.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/database/ideas_test.sql
git commit -m "test(db): pgTAP RLS tests for ideas domain"
```

---

## Task 3: Regenerate types + shared components

**Files:** `src/lib/types/database.ts`, `src/lib/components/StatusBadge.svelte`, `src/lib/components/IdeaCard.svelte`

- [ ] **Step 1: Regenerate types**

Run: `supabase gen types typescript --local 2>/dev/null > src/lib/types/database.ts`
Confirm `ideas`, `categories`, `idea_categories`, `idea_relations` appear in the `Database` type.

- [ ] **Step 2: `StatusBadge.svelte`** (greenscale + `--green` accent per CLAUDE.md)

```svelte
<script lang="ts">
  let { status }: { status: string } = $props();
  const label: Record<string, string> = {
    open: 'Open', resolved: 'Resolved', closed: 'Closed', draft: 'Draft', archived: 'Archived'
  };
</script>
<span class="rounded-full px-2 py-0.5 text-xs font-medium"
      style="border:1px solid var(--line); color:var(--muted);
             {status === 'open' ? 'color:var(--green-deep); border-color:var(--green);' : ''}">
  {label[status] ?? status}
</span>
```

- [ ] **Step 3: `IdeaCard.svelte`**

```svelte
<script lang="ts">
  import StatusBadge from './StatusBadge.svelte';
  let { idea }: { idea: { id: string; title: string; summary_md: string | null; type: string; status: string } } = $props();
</script>
<a href="/ideas/{idea.id}" class="block rounded-2xl border p-5 transition"
   style="border-color:var(--line); background:var(--surface); box-shadow:var(--shadow-1)">
  <div class="mb-2 flex items-center justify-between gap-2">
    <span class="text-xs uppercase tracking-wide" style="color:var(--faint)">{idea.type === 'hypothesis' ? 'Hypothesis' : 'Open-ended'}</span>
    <StatusBadge status={idea.status} />
  </div>
  <h3 class="font-bold" style="color:var(--ink)">{idea.title}</h3>
  {#if idea.summary_md}<p class="mt-1 line-clamp-2 text-sm" style="color:var(--muted)">{idea.summary_md}</p>{/if}
</a>
```

- [ ] **Step 4: Verify** `npm run check` (0 errors) and `npm run build` (clean).

- [ ] **Step 5: Commit** `git add src/lib && git commit -m "feat: regenerate types + IdeaCard/StatusBadge components"`

---

## Task 4: Public browse - `/ideas`

**Files:** `src/routes/ideas/+page.server.ts`, `src/routes/ideas/+page.svelte`

- [ ] **Step 1: `+page.server.ts`** - server load with filters + pagination (RLS scopes visibility)

```ts
import type { PageServerLoad } from './$types';

const PAGE = 24;
export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
  const type = url.searchParams.get('type');       // 'hypothesis' | 'open_ended' | null
  const page = Math.max(0, Number(url.searchParams.get('page') ?? 0));
  let q = supabase
    .from('ideas')
    .select('id, title, summary_md, type, status', { count: 'exact' })
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  if (type === 'hypothesis' || type === 'open_ended') q = q.eq('type', type);
  const { data: ideas, count } = await q;
  return { ideas: ideas ?? [], count: count ?? 0, page, pageSize: PAGE, type };
};
```

- [ ] **Step 2: `+page.svelte`** - grid + type filter + pager

```svelte
<script lang="ts">
  import IdeaCard from '$lib/components/IdeaCard.svelte';
  let { data } = $props();
</script>
<h1 class="mb-4 text-2xl font-bold" style="color:var(--ink)">Ideas</h1>
<nav class="mb-6 flex gap-2 text-sm">
  <a href="/ideas" style="color:{data.type ? 'var(--muted)' : 'var(--green-deep)'}">All</a>
  <a href="/ideas?type=hypothesis" style="color:{data.type === 'hypothesis' ? 'var(--green-deep)' : 'var(--muted)'}">Hypotheses</a>
  <a href="/ideas?type=open_ended" style="color:{data.type === 'open_ended' ? 'var(--green-deep)' : 'var(--muted)'}">Open-ended</a>
</nav>
{#if data.ideas.length === 0}
  <p style="color:var(--muted)">No ideas yet.</p>
{:else}
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each data.ideas as idea (idea.id)}<IdeaCard {idea} />{/each}
  </div>
{/if}
{#if data.count > data.pageSize}
  <div class="mt-6 flex gap-3" style="color:var(--muted)">
    {#if data.page > 0}<a href="/ideas?{data.type ? `type=${data.type}&` : ''}page={data.page - 1}">← Prev</a>{/if}
    {#if (data.page + 1) * data.pageSize < data.count}<a href="/ideas?{data.type ? `type=${data.type}&` : ''}page={data.page + 1}">Next →</a>{/if}
  </div>
{/if}
```

- [ ] **Step 3: Verify** `npm run check` + `npm run build`. Boot dev, `curl -s localhost:5173/ideas | grep -qi "Ideas" && echo OK`.
- [ ] **Step 4: Commit** `git add src/routes/ideas && git commit -m "feat: public idea browse with type filter + pagination"`

---

## Task 5: Idea detail - `/ideas/[id]`

**Files:** `src/routes/ideas/[id]/+page.server.ts`, `src/routes/ideas/[id]/+page.svelte`

- [ ] **Step 1: `+page.server.ts`**

```ts
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const { data: idea } = await supabase
    .from('ideas')
    .select('id, title, summary_md, claim, type, status, resolution, estimated_hours, importance, source_url, author_id')
    .eq('id', params.id)
    .single();                       // RLS returns null if not visible (draft of another user)
  if (!idea) error(404, 'Idea not found');
  const { data: author } = idea.author_id
    ? await supabase.from('profiles').select('handle, display_name').eq('id', idea.author_id).single()
    : { data: null };
  const { data: cats } = await supabase
    .from('idea_categories').select('categories(slug, title)').eq('idea_id', idea.id);
  return { idea, author, categories: (cats ?? []).map((c: any) => c.categories) };
};
```

- [ ] **Step 2: `+page.svelte`** (bio/markdown shown as text for now - no `@html`; sanitized rendering is a later plan)

```svelte
<script lang="ts">
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  let { data } = $props();
</script>
<article class="rounded-2xl border p-6" style="border-color:var(--line); background:var(--surface); box-shadow:var(--shadow-1)">
  <div class="mb-2 flex items-center justify-between">
    <span class="text-xs uppercase tracking-wide" style="color:var(--faint)">{data.idea.type === 'hypothesis' ? 'Hypothesis' : 'Open-ended'}</span>
    <StatusBadge status={data.idea.status} />
  </div>
  <h1 class="text-2xl font-bold" style="color:var(--ink)">{data.idea.title}</h1>
  {#if data.author}<p class="text-sm" style="color:var(--faint)">by <a href="/u/{data.author.handle}" style="color:var(--green-deep)">{data.author.display_name ?? data.author.handle}</a></p>{/if}
  {#if data.idea.claim}<p class="mt-3 italic" style="color:var(--body)">{data.idea.claim}</p>{/if}
  {#if data.idea.summary_md}<p class="mt-3" style="color:var(--body)">{data.idea.summary_md}</p>{/if}
  {#if data.categories.length}<div class="mt-4 flex flex-wrap gap-2">{#each data.categories as c}<span class="rounded-full px-2 py-0.5 text-xs" style="border:1px solid var(--line); color:var(--muted)">{c.title}</span>{/each}</div>{/if}
  {#if data.idea.source_url}<p class="mt-4 text-sm"><a href={data.idea.source_url} target="_blank" rel="noopener" style="color:var(--green-deep)">Source ↗</a></p>{/if}
</article>
```

- [ ] **Step 3: Verify** `npm run check` + `npm run build`.
- [ ] **Step 4: Commit** `git add src/routes/ideas && git commit -m "feat: idea detail page"`

---

## Task 6: Expert console - `/console` (post + list own ideas)

**Files:** `src/routes/console/+page.server.ts`, `src/routes/console/+page.svelte`

- [ ] **Step 1: `+page.server.ts`** - gate to approved experts; list own ideas; create-idea action

```ts
import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

async function requireExpert(supabase: any, userId: string | undefined) {
  if (!userId) return false;
  const { data } = await supabase.from('experts').select('status').eq('id', userId).single();
  return data?.status === 'approved';
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) redirect(303, '/login?next=/console');
  if (!(await requireExpert(supabase, user.id))) error(403, 'Approved experts only');
  const { data: ideas } = await supabase
    .from('ideas').select('id, title, type, status').eq('author_id', user.id)
    .order('created_at', { ascending: false });
  return { ideas: ideas ?? [] };
};

export const actions: Actions = {
  create: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireExpert(supabase, user.id))) return fail(403, { message: 'Approved experts only' });
    const fd = await request.formData();
    const title = String(fd.get('title') ?? '').trim();
    if (!title) return fail(400, { message: 'Title required' });
    const type = fd.get('type') === 'hypothesis' ? 'hypothesis' : 'open_ended';
    const { data, error: e } = await supabase.from('ideas').insert({
      author_id: user.id, title, type,
      summary_md: String(fd.get('summary_md') ?? ''),
      claim: type === 'hypothesis' ? String(fd.get('claim') ?? '') : null,
      status: 'open', published_at: new Date().toISOString()
    }).select('id').single();          // RLS enforces approved-expert + own-author
    if (e) return fail(400, { message: e.message });
    redirect(303, `/ideas/${data!.id}`);
  }
};
```

- [ ] **Step 2: `+page.svelte`**

```svelte
<script lang="ts">
  let { data, form } = $props();
</script>
<h1 class="mb-4 text-2xl font-bold" style="color:var(--ink)">Expert console</h1>

<form method="POST" action="?/create" class="mb-8 flex flex-col gap-2 rounded-2xl border p-5"
      style="border-color:var(--line); background:var(--surface)">
  <h2 class="font-bold" style="color:var(--ink)">Post a new idea</h2>
  <input name="title" placeholder="Title" required class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
  <select name="type" class="rounded-xl border px-3 py-2" style="border-color:var(--line)">
    <option value="open_ended">Open-ended</option>
    <option value="hypothesis">Hypothesis (yes/no)</option>
  </select>
  <input name="claim" placeholder="Hypothesis claim (if hypothesis)" class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
  <textarea name="summary_md" placeholder="Summary (markdown)" class="rounded-xl border px-3 py-2" style="border-color:var(--line)"></textarea>
  <button class="self-start rounded-xl px-4 py-2 font-medium" style="background:var(--ink); color:#fff">Publish</button>
  {#if form?.message}<span style="color:var(--neg)">{form.message}</span>{/if}
</form>

<h2 class="mb-2 font-bold" style="color:var(--ink)">Your ideas</h2>
{#if data.ideas.length === 0}<p style="color:var(--muted)">No ideas yet.</p>{:else}
  <ul class="flex flex-col gap-2">
    {#each data.ideas as i (i.id)}<li><a href="/ideas/{i.id}" style="color:var(--green-deep)">{i.title}</a> <span style="color:var(--faint)">· {i.status}</span></li>{/each}
  </ul>
{/if}
```

- [ ] **Step 3: Verify** `npm run check` + `npm run build`.
- [ ] **Step 4: Commit** `git add src/routes/console && git commit -m "feat: expert console - post + list own ideas (expert-gated)"`

---

## Task 7: Admin expert-vetting - `/admin/experts`

**Files:** `src/routes/admin/experts/+page.server.ts`, `src/routes/admin/experts/+page.svelte`

- [ ] **Step 1: `+page.server.ts`** - gate to admins; list experts; approve/revoke actions

```ts
import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

async function requireAdmin(supabase: any, userId: string | undefined) {
  if (!userId) return false;
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', userId).single();
  return data?.is_admin === true;
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) redirect(303, '/login?next=/admin/experts');
  if (!(await requireAdmin(supabase, user.id))) error(403, 'Admins only');
  const { data: experts } = await supabase
    .from('experts').select('id, status, specialty, profiles(handle, display_name)')
    .order('created_at', { ascending: false });
  return { experts: experts ?? [] };
};

export const actions: Actions = {
  setStatus: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireAdmin(supabase, user.id))) return fail(403, { message: 'Admins only' });
    const fd = await request.formData();
    const id = String(fd.get('id'));
    const status = String(fd.get('status'));
    if (!['approved', 'revoked', 'pending'].includes(status)) return fail(400, { message: 'Bad status' });
    const patch: Record<string, unknown> = { status };
    if (status === 'approved') { patch.approved_by = user.id; patch.approved_at = new Date().toISOString(); }
    const { error: e } = await supabase.from('experts').update(patch).eq('id', id); // RLS: admins manage experts
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  }
};
```

- [ ] **Step 2: `+page.svelte`**

```svelte
<script lang="ts">
  let { data, form } = $props();
</script>
<h1 class="mb-4 text-2xl font-bold" style="color:var(--ink)">Expert vetting</h1>
{#if form?.message}<p style="color:var(--neg)">{form.message}</p>{/if}
<table class="w-full text-sm">
  <thead><tr style="color:var(--faint)"><th class="text-left">Person</th><th class="text-left">Status</th><th></th></tr></thead>
  <tbody>
    {#each data.experts as e (e.id)}
      <tr style="border-top:1px solid var(--line)">
        <td class="py-2" style="color:var(--ink)">{e.profiles?.display_name ?? e.profiles?.handle ?? e.id}</td>
        <td style="color:var(--muted)">{e.status}</td>
        <td class="py-2 text-right">
          <form method="POST" action="?/setStatus" class="inline">
            <input type="hidden" name="id" value={e.id} />
            <button name="status" value="approved" class="mr-2" style="color:var(--green-deep)">Approve</button>
            <button name="status" value="revoked" style="color:var(--neg)">Revoke</button>
          </form>
        </td>
      </tr>
    {/each}
  </tbody>
</table>
```

- [ ] **Step 3: Verify** `npm run check` + `npm run build`.
- [ ] **Step 4: Commit** `git add src/routes/admin && git commit -m "feat: admin expert-vetting (approve/revoke)"`

---

## Task 8: Tests - loader units + E2E + final suite

**Files:** `src/routes/ideas/ideas.test.ts`, `e2e/ideas.spec.ts`

- [ ] **Step 1: Loader unit test** `src/routes/ideas/ideas.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { load } from './+page.server';

function mkLocals(rows: unknown[]) {
  const builder: any = {
    select() { return this; }, neq() { return this; }, order() { return this; }, eq() { return this; },
    range() { return Promise.resolve({ data: rows, count: rows.length }); }
  };
  return { supabase: { from: () => builder } } as any;
}

describe('ideas browse load', () => {
  it('returns ideas + count', async () => {
    const res = await load({ url: new URL('http://x/ideas'), locals: mkLocals([{ id: '1', title: 'A' }]) } as any);
    expect(res.ideas.length).toBe(1);
    expect(res.count).toBe(1);
  });
});
```

- [ ] **Step 2: E2E** `e2e/ideas.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test('ideas browse renders', async ({ page }) => {
  await page.goto('/ideas');
  await expect(page.getByRole('heading', { name: 'Ideas' })).toBeVisible();
});

test('console requires auth', async ({ page }) => {
  await page.goto('/console');
  await expect(page).toHaveURL(/\/login/);
});

test('admin experts requires auth', async ({ page }) => {
  await page.goto('/admin/experts');
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step 3: Run the full suite**

Run: `npm run check` (0 errors), `npx vitest run` (passes), `supabase test db` (pgTAP all pass), `npm run build` (clean), and (free port first) `npx playwright test` (passes).

- [ ] **Step 4: Commit** `git add . && git commit -m "test: ideas loader unit + browse/console/admin E2E"`

---

## Done-when (Plan 2 acceptance)
- `ideas`/`categories`/`idea_categories`/`idea_relations` exist with RLS; pgTAP proves: only approved experts insert ideas, draft visibility is author/admin-only, non-authors can't edit, categories are admin-only.
- Public can browse non-draft ideas (filtered/paginated) and view an idea; approved experts can post + see their ideas; admins can approve/revoke experts.
- Schema carries `legacy_id` + `legacy jsonb` so the later ETL is lossless.
- All suites green; no secrets; no `@html` of user content.

**After merge:** controller applies both migrations to cloud `gjomchhbsbtauzkpyjwa` via MCP; then author Plan 3 (Answers & Verification).
