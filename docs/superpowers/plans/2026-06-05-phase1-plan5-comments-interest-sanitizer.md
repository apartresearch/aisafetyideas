# AI Safety Ideas - Phase 1 · Plan 5: Comments, Interest, Experts roster & Markdown sanitizer - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Finish the Phase-1 **data model** - `comments` + `interest` (the last spec §6 tables) - add a public **experts roster** (`/experts`), and introduce a **server-side Markdown sanitizer** so user content renders as real, safe HTML instead of the temporary `whitespace-pre-wrap` plain text. This completes the schema so the later ETL can losslessly restore the old 83 comments + 133 interests, and closes the "no `@html` of unsanitized user content" requirement from `CLAUDE.md` properly.

**Architecture:** Builds on Plans 1–4. `comments`/`interest` follow the established posture: plain RLS INSERT pinned to `auth.uid()`, `legacy_id`/`legacy` pinned (service-role-only), and **visibility-gated SELECT** (a comment/interest is readable only when its idea is - mirroring `idea_funding`). Markdown is rendered + sanitized **server-side** in `$lib/server/markdown.ts` (so `marked` + DOMPurify never ship to the client); loaders produce `*_html` fields and components `{@html}` the pre-sanitized output. Comments are flat (top-level) in the v1 UI; the `reply_to` column exists for the ETL + future threading.

**Tech Stack:** Plans 1–4 stack + two new server-only deps: **`marked`** (Markdown→HTML) and **`isomorphic-dompurify`** (sanitize, works under SSR/Node + the jsdom test env).

**Cloud note (controller-handled, NOT a subagent task):** subagents develop + test against the **local** stack only. After the migration is finalized and reviewed, the controller applies it to cloud `gjomchhbsbtauzkpyjwa` via the Supabase MCP and re-runs `get_advisors`. Subagents must NOT touch the cloud, `CLAUDE.md`, `docs/`, `.claude/`, or `src_legacy_v0/`.

---

## Key design decisions

- **Comments/interest read = idea visibility** (mirrors `idea_funding`): `using (exists (select 1 from public.ideas i where i.id = idea_id))` - the `ideas` RLS hides drafts, so comments/interest on a non-public idea aren't leaked, and the same gate keeps them off un-published ideas.
- **Plain RLS INSERT, pinned:** `author_id`/`profile_id = auth.uid()`, `legacy_id IS NULL AND legacy = '{}'` (service-role-only ETL anchors). No money, no RPC.
- **Comments: insert + delete, no edit.** `SELECT` (idea-visible) · `INSERT` (own, on a visible idea) · `DELETE` (own **or** admin, for moderation). **No UPDATE policy** - editing is delete-and-repost in v1 (keeps the surface minimal; matches the deny-by-default ethos). `reply_to uuid → comments(id) on delete cascade` is stored for ETL/future threading but the v1 UI posts only top-level comments.
- **Interest is a toggle:** `unique (idea_id, profile_id)` so one interest per member per idea; `INSERT` (own) / `DELETE` (own). `note_md` optional (the old `how` column maps here). Withdraw is a fail-loud delete (`.select()` + 409), like the Plan-4 pledge withdraw.
- **`author_id`/`profile_id` are `on delete set null`** (a comment/interest outlives a deleted account; original anchored in `legacy`), mirroring every other table.
- **Markdown is sanitized server-side.** `$lib/server/markdown.ts#renderMarkdown(md)` = `marked` → `isomorphic-dompurify`; it lives under `$lib/server` so the deps stay out of the client bundle. Loaders compute `*_html` (e.g. `summary_html`, `explanation_html`, `body_html`, `bio_html`) for the `*_md` columns and the components render `{@html ...}` of that **already-sanitized** string - never `{@html}` of raw user input. Beyond DOMPurify's default (strips `<script>`/`on*`/`javascript:`/`data:`), the config **forbids interactive form controls** (`FORBID_TAGS`, anti-phishing) and the **`style` attribute** (`FORBID_ATTR`, anti-clickjacking), and an `afterSanitizeAttributes` hook adds `rel="noopener noreferrer"` to any `target` link. The plain-text hypothesis **`claim`** (a yes/no statement, not `*_md`) is rendered as escaped plain text, **not** through markdown. Comment/interest bodies are length-capped in the action as a cheap pre-limit.
- **Experts roster `/experts`** is a public list of `experts.status='approved'` (featured first), linking to the existing `/u/[handle]` profile. No separate `/experts/[handle]` (the profile already lives at `/u/[handle]`).
- **ETL mapping:** old `comments` (`text`→`body_md`, `reply_to` self-ref, `anon_author`/`anon_author_url`/`upvotes`→`legacy`) and `idea_user_interest_relation` (`how`→`note_md`, `contact_if_started`→`legacy`) land via `legacy_id` + `legacy jsonb`, imported by the service-role ETL.
- **Rate-limiting (spec §9)** for the new comment/interest endpoints remains part of the deferred single app-wide pass; not built here.

---

## File structure (Plan 5)

| File | Responsibility |
|---|---|
| `supabase/migrations/<ts>_comments_interest.sql` | `comments` + `interest` tables + RLS + indexes |
| `supabase/tests/database/comments_interest_test.sql` | pgTAP RLS tests |
| `package.json` / `package-lock.json` | add `marked` + `isomorphic-dompurify` |
| `src/lib/server/markdown.ts` | `renderMarkdown()` - server-only MD→sanitized HTML |
| `src/lib/markdown.test.ts` | Vitest unit (renders + sanitizes) |
| `src/lib/types/database.ts` | Regenerated (comments + interest) |
| `src/lib/components/AnswerCard.svelte`, `Markdown.svelte` | `Markdown.svelte` renders pre-sanitized HTML; AnswerCard uses it |
| `src/routes/u/[handle]/+page.server.ts` / `+page.svelte` | **Modify**: sanitize `bio_md` → `bio_html` |
| `src/routes/console/+page.server.ts` / `+page.svelte` | **Modify**: sanitize queue `explanation_md` → `explanation_html` |
| `src/routes/ideas/[id]/+page.server.ts` / `+page.svelte` | **Modify**: sanitize idea/answers; add comments + interest (load + actions + UI) |
| `src/routes/experts/+page.server.ts` / `+page.svelte` | New public experts roster |
| `e2e/social.spec.ts` | E2E |

---

## Task 1: Migration - comments + interest

**Files:** `supabase/migrations/<ts>_comments_interest.sql`

- [ ] **Step 1: Create the migration**

`supabase migration new comments_interest`, contents:

```sql
-- ============ comments (flat in v1 UI; reply_to stored for ETL + future threading) ============
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  legacy_id  bigint unique,
  idea_id    uuid not null references public.ideas(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,
  body_md    text not null,
  reply_to   uuid references public.comments(id) on delete cascade,
  legacy     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.comments enable row level security;
create index comments_idea_id_idx on public.comments (idea_id);
create index comments_reply_to_idx on public.comments (reply_to);
create index comments_author_id_idx on public.comments (author_id);

-- SELECT: readable when its idea is visible (ideas RLS hides drafts) OR the caller is the author
-- (mirrors idea_funding's "own row always visible" branch, so an author keeps their comment if the idea reverts to draft)
create policy "comments readable when idea visible or own" on public.comments for select
  using (
    (select auth.uid()) = author_id
    or exists (select 1 from public.ideas i where i.id = idea_id)
  );
-- INSERT: any member comments as themselves on a visible idea; author + legacy pinned
create policy "members comment on visible ideas" on public.comments for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and legacy_id is null and legacy = '{}'::jsonb
    and exists (select 1 from public.ideas i where i.id = idea_id)
  );
-- DELETE: the author, or an admin (moderation)
create policy "author or admin deletes comment" on public.comments for delete to authenticated
  using ((select auth.uid()) = author_id or public.is_admin());
-- NOTE: no UPDATE policy - editing is delete-and-repost in v1.

-- ============ interest (one per member per idea; a toggle) ============
create table public.interest (
  id         uuid primary key default gen_random_uuid(),
  legacy_id  bigint unique,
  idea_id    uuid not null references public.ideas(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  note_md    text,
  legacy     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (idea_id, profile_id)
);
alter table public.interest enable row level security;
create index interest_idea_id_idx on public.interest (idea_id);
create index interest_profile_id_idx on public.interest (profile_id);  -- covers the profile_id FK (set-null cascade) + advisor

-- SELECT: readable when the idea is visible OR the caller is the interested member
create policy "interest readable when idea visible or own" on public.interest for select
  using (
    (select auth.uid()) = profile_id
    or exists (select 1 from public.ideas i where i.id = idea_id)
  );
-- INSERT: a member expresses their OWN interest on a visible idea; profile + legacy pinned
create policy "members express interest on visible ideas" on public.interest for insert to authenticated
  with check (
    (select auth.uid()) = profile_id
    and legacy_id is null and legacy = '{}'::jsonb
    and exists (select 1 from public.ideas i where i.id = idea_id)
  );
-- DELETE: a member withdraws their own interest
create policy "member withdraws own interest" on public.interest for delete to authenticated
  using ((select auth.uid()) = profile_id);
-- NOTE: no UPDATE policy - toggle is insert/delete; note set at insert.
```

- [ ] **Step 2: Apply locally**

Run: `supabase db reset` (full rebuild - not `migration up`).
Expected: all migrations (Plans 1–5) apply with no errors.

- [ ] **Step 3: Smoke-check**

Run: `docker exec supabase_db_aisafetyideas psql -U postgres -d postgres -c "select tablename, cmd, roles from pg_policies where schemaname='public' and tablename in ('comments','interest') order by 1,2;"`
Expected: each table has exactly 3 policies - `SELECT` with `roles={public}` (anon-readable), `INSERT` and `DELETE` with `roles={authenticated}`. (No `UPDATE` policy on either.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): comments + interest tables + RLS (Plan 5)"
```

---

## Task 2: pgTAP - comments + interest RLS

**Files:** `supabase/tests/database/comments_interest_test.sql`

- [ ] **Step 1: Write the test**

```sql
begin;
select plan(18);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','alice@example.com','x', now(), now(), now()),  -- author/expert
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','bob@example.com','x', now(), now(), now()),    -- member
  ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333','authenticated','authenticated','carol@example.com','x', now(), now(), now()),  -- admin
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','dave@example.com','x', now(), now(), now());

update public.profiles set is_admin = true where id = '33333333-3333-3333-3333-333333333333';
insert into public.experts (id, status) values ('11111111-1111-1111-1111-111111111111','approved');
insert into public.ideas (id, author_id, type, title, status) values
  ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','open_ended','Open idea','open'),
  ('a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','open_ended','Draft idea','draft');

set local role authenticated;

-- ===== bob comments + expresses interest (insert pinning) =====
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into public.comments (id, idea_id, author_id, body_md)
  values ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Nice idea');
select ok((select count(*) from public.comments) = 1, '1: member comments on a visible idea');                                              -- 1
select throws_ok($$ insert into public.comments (idea_id, author_id, body_md)
  values ('a0000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','spoof') $$,
  '42501', null, '2: cannot comment as another author');                                                                                    -- 2
select throws_ok($$ insert into public.comments (idea_id, author_id, body_md)
  values ('a0000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','on draft') $$,
  '42501', null, '3: cannot comment on a draft idea');                                                                                      -- 3
select throws_ok($$ insert into public.comments (idea_id, author_id, body_md, legacy_id)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','squat',7) $$,
  '42501', null, '4: cannot set legacy_id on a live comment');                                                                              -- 4
select throws_ok($$ insert into public.comments (idea_id, author_id, body_md, legacy)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','squat','{"a":1}'::jsonb) $$,
  '42501', null, '5: cannot set a non-empty legacy on a live comment');                                                                     -- 5
insert into public.interest (id, idea_id, profile_id, note_md)
  values ('d0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','keen');
select ok((select count(*) from public.interest) = 1, '6: member expresses interest');                                                     -- 6
select throws_ok($$ insert into public.interest (idea_id, profile_id)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222') $$,
  '23505', null, '7: one interest per member per idea (unique)');                                                                           -- 7
select throws_ok($$ insert into public.interest (idea_id, profile_id)
  values ('a0000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333') $$,
  '42501', null, '8: cannot express interest on behalf of another');                                                                        -- 8
select throws_ok($$ insert into public.interest (idea_id, profile_id, legacy)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','{"a":1}'::jsonb) $$,
  '42501', null, '9: cannot set a non-empty legacy on a live interest');                                                                    -- 9

-- ===== anon can read comments/interest on a visible idea =====
set local role anon;
select ok((select count(*) from public.comments) = 1, '10: comments are publicly readable on a visible idea');                             -- 10
select ok((select count(*) from public.interest) = 1, '11: interest is publicly readable on a visible idea');                              -- 11

-- ===== draft-idea comment AND interest are not leaked (seed both as owner, bypass RLS) =====
reset role;
insert into public.comments (id, idea_id, author_id, body_md)
  values ('c0000000-0000-0000-0000-000000000009','a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','draft comment');
insert into public.interest (id, idea_id, profile_id)
  values ('d0000000-0000-0000-0000-000000000009','a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111');
set local role anon;
select is((select count(*) from public.comments where idea_id='a0000000-0000-0000-0000-000000000002'),
  0::bigint, '12: comments on a draft idea are not leaked to the public');                                                                  -- 12
select is((select count(*) from public.interest where idea_id='a0000000-0000-0000-0000-000000000002'),
  0::bigint, '13: interest on a draft idea is not leaked to the public');                                                                   -- 13

-- ===== delete: non-author can't; admin can (moderation); author can delete own =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';  -- dave
delete from public.comments where id='c0000000-0000-0000-0000-000000000001';
select is((select count(*) from public.comments where id='c0000000-0000-0000-0000-000000000001'),
  1::bigint, '14: a non-author/non-admin cannot delete a comment');                                                                        -- 14
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';  -- admin carol
delete from public.comments where id='c0000000-0000-0000-0000-000000000001';
select ok((select count(*) from public.comments where id='c0000000-0000-0000-0000-000000000001') = 0,
  '15: an admin can delete a comment (moderation)');                                                                                       -- 15
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';  -- bob
insert into public.comments (id, idea_id, author_id, body_md)
  values ('c0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','my own');
delete from public.comments where id='c0000000-0000-0000-0000-000000000002';
select ok((select count(*) from public.comments where id='c0000000-0000-0000-0000-000000000002') = 0,
  '16: an author can delete their own comment');                                                                                           -- 16

-- ===== interest: cannot withdraw another's; can withdraw own =====
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';  -- dave
delete from public.interest where id='d0000000-0000-0000-0000-000000000001';
select is((select count(*) from public.interest where id='d0000000-0000-0000-0000-000000000001'),
  1::bigint, '17: a member cannot withdraw another member''s interest');                                                                   -- 17
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';  -- bob
delete from public.interest where id='d0000000-0000-0000-0000-000000000001';
select ok((select count(*) from public.interest where id='d0000000-0000-0000-0000-000000000001') = 0,
  '18: a member withdraws their own interest');                                                                                            -- 18

select * from finish();
rollback;
```

- [ ] **Step 2: Run**

Run: `supabase test db`
Expected: **18/18** pass (this file) + Plans 1–4 suites all pass. Do NOT weaken RLS to pass. If you change the assertion count, set `plan(N)` to match (`grep -cE 'select (ok|is|throws_ok|lives_ok)\(' comments_interest_test.sql` must equal N).

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/database/comments_interest_test.sql
git commit -m "test(db): pgTAP RLS tests for comments + interest"
```

---

## Task 3: Markdown sanitizer (deps + server util + types + unit test)

**Files:** `package.json`/`package-lock.json`, `src/lib/server/markdown.ts`, `src/lib/markdown.test.ts`, `src/lib/types/database.ts`, `src/lib/components/Markdown.svelte`

- [ ] **Step 1: Add the deps**

Run: `npm install marked isomorphic-dompurify`
This pins both into `dependencies` and updates `package-lock.json`. Commit the lockfile with the code (Step 6).

- [ ] **Step 2: `src/lib/server/markdown.ts`** (server-only - keeps `marked`/DOMPurify out of the client bundle)

```ts
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

marked.setOptions({ gfm: true, breaks: true });

// Defense-in-depth: any link that opens a new tab must not reach window.opener (reverse-tabnabbing).
// Registered once at module load (DOMPurify is a singleton in isomorphic-dompurify).
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target')) {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/**
 * Render user-authored Markdown to SANITIZED HTML, server-side.
 * Lives under $lib/server so the heavy deps never ship to the browser.
 * DOMPurify's default HTML profile strips <script>, on* handlers, and javascript:/data: URLs; on top of that we
 * forbid interactive form controls (phishing) and the style attribute (CSS clickjacking / UI-redressing).
 */
export function renderMarkdown(md: string | null | undefined): string {
  if (!md) return '';
  const html = marked.parse(md, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['form', 'input', 'button', 'select', 'option', 'textarea', 'label', 'fieldset', 'style'],
    FORBID_ATTR: ['style']
  });
}
```

- [ ] **Step 3: `src/lib/markdown.test.ts`** (Vitest)

```ts
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './server/markdown';

describe('renderMarkdown', () => {
  it('renders basic markdown', () => {
    const html = renderMarkdown('**bold** and [link](https://example.com)');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('href="https://example.com"');
  });
  it('strips <script>', () => {
    const html = renderMarkdown('hi <script>alert(1)</script>');
    expect(html).not.toContain('<script>');
  });
  it('strips event handlers and javascript: urls', () => {
    const html = renderMarkdown('<a href="javascript:alert(1)" onclick="x()">x</a>');
    expect(html).not.toContain('onclick');
    expect(html.toLowerCase()).not.toContain('javascript:');
  });
  it('strips onerror on a SURVIVING <img> (the real boundary case)', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)>');
    expect(html).toContain('<img');                 // the element survives DOMPurify's html profile…
    expect(html.toLowerCase()).not.toContain('onerror'); // …but the handler attribute is stripped
  });
  it('strips form controls (phishing) and the style attribute (clickjacking)', () => {
    const f = renderMarkdown('<form action="https://evil"><input name="x"></form>');
    expect(f.toLowerCase()).not.toContain('<form');
    expect(f.toLowerCase()).not.toContain('<input');
    const s = renderMarkdown('<a href="https://x" style="position:fixed;inset:0">x</a>');
    expect(s).not.toContain('style=');
  });
  it('neutralizes data:text/html links', () => {
    const html = renderMarkdown('[x](data:text/html,<script>alert(1)</script>)');
    expect(html.toLowerCase()).not.toContain('data:text/html');
  });
  it('empty/nullish → empty string', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown(undefined)).toBe('');
  });
});
```

- [ ] **Step 4: Regenerate types** (the new tables): `supabase gen types typescript --local 2>/dev/null > src/lib/types/database.ts`. Confirm `comments` + `interest` appear under `Tables`.

- [ ] **Step 5: `src/lib/components/Markdown.svelte`** (renders ALREADY-sanitized HTML; the only sanctioned `@html`)

```svelte
<script lang="ts">
  // `html` MUST be the output of $lib/server/markdown#renderMarkdown (already sanitized server-side).
  let { html, class: klass = '' }: { html: string; class?: string } = $props();
</script>
{#if html}
  <!-- eslint-disable-next-line svelte/no-at-html-tags - server-sanitized via renderMarkdown -->
  <div class="prose-sm {klass}" style="color:var(--body)">{@html html}</div>
{/if}
```

- [ ] **Step 6: Verify + commit** `npm run check` (0 errors), `npx vitest run` (renderMarkdown passes), `npm run build` (clean). Then:

```bash
git add package.json package-lock.json src/lib/server/markdown.ts src/lib/markdown.test.ts src/lib/components/Markdown.svelte src/lib/types/database.ts
git commit -m "feat: server-side Markdown sanitizer (marked + DOMPurify) + Markdown component"
```

---

## Task 4: Apply the sanitizer to existing surfaces (profile bio + console queue)

**Files:** `src/routes/u/[handle]/+page.server.ts` / `+page.svelte`, `src/routes/console/+page.server.ts` / `+page.svelte`

> Idea-detail + AnswerCard get the sanitizer in Task 5 (where that surface is rewritten anyway). This task covers the two standalone spots.

- [ ] **Step 1: Profile - sanitize `bio_md`.** In `src/routes/u/[handle]/+page.server.ts`, import the sanitizer and add `bio_html` to the returned profile data.

Add at the top: `import { renderMarkdown } from '$lib/server/markdown';`
Where the loader returns the profile, add a sibling field, e.g.:
```ts
  return { profile, bio_html: renderMarkdown(profile.bio_md), /* ...existing fields... */ };
```
(Keep all existing returned fields; only ADD `bio_html`.)

- [ ] **Step 2: Profile svelte** - replace ONLY the read-only bio render `<p class="mt-3" ...>{data.profile.bio_md ?? ''}</p>` with the sanitized component (leave the edit `<textarea name="bio_md">` intact - it must keep the RAW `bio_md` for editing):
```svelte
  <Markdown html={data.bio_html} class="mt-3" />
```
Add `import Markdown from '$lib/components/Markdown.svelte';` to the `<script>`.

- [ ] **Step 3: Console queue - sanitize `explanation_md`.** In `src/routes/console/+page.server.ts`, import `renderMarkdown` and, when building the `queue`, add `explanation_html: renderMarkdown(q.explanation_md)` to each normalized row (alongside the existing `submitter`/`ideas` normalization).

- [ ] **Step 4: Console svelte** - replace the queue's WHOLE `{#if a.explanation_md}<p class="... whitespace-pre-wrap ...">{a.explanation_md}</p>{/if}` block with `<Markdown html={a.explanation_html} class="mb-2" />` (Markdown self-guards on empty `html`) and import `Markdown from '$lib/components/Markdown.svelte'`.

- [ ] **Step 5: Verify** `npm run check` (0 errors) + `npm run build` (clean).

- [ ] **Step 6: Commit** `git add src/routes/u src/routes/console && git commit -m "feat: render profile bio + review-queue explanations as sanitized markdown"`

---

## Task 5: Idea detail - sanitized content + comments + interest

**Files:** `src/routes/ideas/[id]/+page.server.ts` / `+page.svelte` (modify), `src/lib/components/AnswerCard.svelte` (modify)

- [ ] **Step 1: AnswerCard - render sanitized explanation.** Replace the `{#if answer.explanation_md}<p ... whitespace-pre-wrap ...>{answer.explanation_md}</p>{/if}` block with:
```svelte
  {#if answer.explanation_html}<Markdown html={answer.explanation_html} class="mt-2" />{/if}
```
Add `import Markdown from './Markdown.svelte';` and change the prop type field `explanation_md: string | null` → `explanation_html?: string | null` (the loader now supplies sanitized HTML).

- [ ] **Step 2: REPLACE `src/routes/ideas/[id]/+page.server.ts`** (extends the Plan-4 loader: sanitizes idea + answers; adds comments + interest; adds `comment`/`delete_comment`/`interest`/`uninterest` actions alongside the existing `pledge`)

```ts
import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { renderMarkdown } from '$lib/server/markdown';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  const { data: idea } = await supabase
    .from('ideas')
    .select('id, title, summary_md, claim, type, status, resolution, estimated_hours, importance, source_url, author_id, currency')
    .eq('id', params.id)
    .single();
  if (!idea) error(404, 'Idea not found');

  const { data: author } = idea.author_id
    ? await supabase.from('profiles').select('handle, display_name').eq('id', idea.author_id).single()
    : { data: null };

  const { data: cats } = await supabase
    .from('idea_categories').select('categories(slug, title)').eq('idea_id', idea.id);

  const { data: rawAnswers } = await supabase
    .from('answers')
    .select(
      'id, title, explanation_md, status, payout_amount_cents, submitter_id,' +
        ' answer_artifacts(id, kind, url, label),' +
        ' submitter:profiles!answers_submitter_id_fkey(handle, display_name)'
    )
    .eq('idea_id', idea.id)
    .order('created_at', { ascending: true });
  const answers = (rawAnswers ?? []).map((a: any) => ({
    id: a.id, title: a.title, status: a.status, payout_amount_cents: a.payout_amount_cents,
    answer_artifacts: a.answer_artifacts,
    explanation_html: renderMarkdown(a.explanation_md),   // field-picked: don't ship raw explanation_md to the client
    submitter: Array.isArray(a.submitter) ? (a.submitter[0] ?? null) : a.submitter
  }));

  const { data: pot } = await supabase
    .from('bounty_pot').select('pot_cents, funder_count').eq('idea_id', idea.id).maybeSingle();
  const { data: rawFunders } = await supabase
    .from('idea_funding')
    .select('amount_cents, currency, funder_id, funder:profiles(handle, display_name)')
    .eq('idea_id', idea.id).in('status', ['committed', 'escrowed'])
    .order('created_at', { ascending: false });
  const funderMap = new Map<string, { key: string; name: string; amount_cents: number; currency: string }>();
  for (const f of (rawFunders ?? []) as any[]) {
    const prof = Array.isArray(f.funder) ? (f.funder[0] ?? null) : f.funder;
    const key = f.funder_id ?? 'anon';
    const cur = funderMap.get(key) ?? {
      key, name: prof?.display_name ?? prof?.handle ?? 'Anonymous', amount_cents: 0, currency: f.currency ?? 'USD'
    };
    cur.amount_cents += f.amount_cents;
    funderMap.set(key, cur);
  }
  const funders = [...funderMap.values()];

  // comments (flat, oldest first) with sanitized bodies
  const { data: rawComments } = await supabase
    .from('comments')
    .select('id, body_md, author_id, created_at, author:profiles(handle, display_name)')
    .eq('idea_id', idea.id)
    .order('created_at', { ascending: true });
  const comments = (rawComments ?? []).map((c: any) => ({
    id: c.id,
    author_id: c.author_id,
    author: Array.isArray(c.author) ? (c.author[0] ?? null) : c.author,
    body_html: renderMarkdown(c.body_md)
  }));

  // interest: total + whether the current user is interested
  const { count: interestCount } = await supabase
    .from('interest').select('id', { count: 'exact', head: true }).eq('idea_id', idea.id);
  let myInterestId: string | null = null;
  let isAdmin = false;
  if (user) {
    const { data: mine } = await supabase
      .from('interest').select('id').eq('idea_id', idea.id).eq('profile_id', user.id).maybeSingle();
    myInterestId = mine?.id ?? null;
    // real admin status (from the DB, never user_metadata) so an admin sees the moderation delete control
    const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    isAdmin = me?.is_admin === true;
  }

  return {
    idea,
    summary_html: renderMarkdown(idea.summary_md),
    author,
    categories: (cats ?? []).map((c: any) => c.categories),
    answers,
    pot: { pot_cents: pot?.pot_cents ?? 0, funder_count: pot?.funder_count ?? 0 },
    funders,
    comments,
    interestCount: interestCount ?? 0,
    myInterestId,
    isAdmin,
    userId: user?.id ?? null,
    canSubmit: !!user && idea.status === 'open',
    canFund: !!user && idea.status === 'open',
    canEngage: !!user
  };
};

export const actions: Actions = {
  pledge: async ({ request, params, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in to fund this idea' });
    const fd = await request.formData();
    const dollars = Number(fd.get('amount') ?? '');
    if (!Number.isFinite(dollars) || dollars <= 0) return fail(400, { message: 'Enter an amount greater than 0' });
    const { error: e } = await supabase.from('idea_funding').insert({
      idea_id: params.id, funder_id: user.id, amount_cents: Math.round(dollars * 100), status: 'committed'
    });
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  },

  comment: async ({ request, params, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in to comment' });
    const fd = await request.formData();
    const body_md = String(fd.get('body_md') ?? '').trim();
    if (!body_md) return fail(400, { message: 'Write something first' });
    if (body_md.length > 10000) return fail(400, { message: 'Comment is too long (max 10,000 characters)' });
    // RLS enforces author = self + visible idea + legacy pinned
    const { error: e } = await supabase.from('comments').insert({
      idea_id: params.id, author_id: user.id, body_md
    });
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  },

  delete_comment: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in' });
    const fd = await request.formData();
    // RLS allows deleting only your own comment (or admin); .select() surfaces a no-op
    const { data: del, error: e } = await supabase.from('comments')
      .delete().eq('id', String(fd.get('comment_id'))).select('id');
    if (e) return fail(400, { message: e.message });
    if (!del?.length) return fail(403, { message: 'Not allowed to delete that comment' });
    return { ok: true };
  },

  interest: async ({ request, params, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in to express interest' });
    const fd = await request.formData();
    const note_md = String(fd.get('note_md') ?? '').trim().slice(0, 2000) || null;
    const { error: e } = await supabase.from('interest').insert({
      idea_id: params.id, profile_id: user.id, note_md
    });
    if (e) {
      // a duplicate (double-click / stale tab) means "already interested" - idempotent, don't leak the constraint name
      if ((e as { code?: string }).code === '23505') return { ok: true };
      return fail(400, { message: e.message });
    }
    return { ok: true };
  },

  uninterest: async ({ request, params, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in' });
    const { data: del, error: e } = await supabase.from('interest')
      .delete().eq('idea_id', params.id).eq('profile_id', user.id).select('id');
    if (e) return fail(400, { message: e.message });
    if (!del?.length) return fail(409, { message: 'You were not marked interested' });
    return { ok: true };
  }
};
```

- [ ] **Step 3: REPLACE `src/routes/ideas/[id]/+page.svelte`** (sanitized idea body via `Markdown`; comments + interest sections; keeps BountyMeter/pledge/answers)

```svelte
<script lang="ts">
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import AnswerCard from '$lib/components/AnswerCard.svelte';
  import BountyMeter from '$lib/components/BountyMeter.svelte';
  import Money from '$lib/components/Money.svelte';
  import Markdown from '$lib/components/Markdown.svelte';
  let { data, form } = $props();
</script>
<div class="grid gap-6 lg:grid-cols-[1fr_280px]">
  <div>
    <article class="rounded-2xl border p-6" style="border-color:var(--line); background:var(--surface); box-shadow:var(--shadow-1)">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-xs uppercase tracking-wide" style="color:var(--faint)">{data.idea.type === 'hypothesis' ? 'Hypothesis' : 'Open-ended'}</span>
        <StatusBadge status={data.idea.status} />
      </div>
      <h1 class="text-2xl font-bold" style="color:var(--ink)">{data.idea.title}</h1>
      {#if data.author}<p class="text-sm" style="color:var(--faint)">by <a href="/u/{data.author.handle}" style="color:var(--green-deep)">{data.author.display_name ?? data.author.handle}</a></p>{/if}
      {#if data.idea.claim}<p class="mt-3 italic" style="color:var(--body)">{data.idea.claim}</p>{/if}
      {#if data.summary_html}<Markdown html={data.summary_html} class="mt-3" />{/if}
      {#if data.categories.length}<div class="mt-4 flex flex-wrap gap-2">{#each data.categories as c}<span class="rounded-full px-2 py-0.5 text-xs" style="border:1px solid var(--line); color:var(--muted)">{c.title}</span>{/each}</div>{/if}
      {#if data.idea.source_url}<p class="mt-4 text-sm"><a href={data.idea.source_url} target="_blank" rel="noopener" style="color:var(--green-deep)">Source ↗</a></p>{/if}
    </article>

    <section class="mt-8">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-xl font-bold" style="color:var(--ink)">Answers</h2>
        {#if data.canSubmit}<a href="/ideas/{data.idea.id}/answer" class="rounded-xl px-4 py-2 text-sm font-medium" style="background:var(--ink); color:#fff">Submit an answer</a>{/if}
      </div>
      {#if data.answers.length === 0}<p style="color:var(--muted)">No answers yet.</p>{:else}
        <div class="flex flex-col gap-3">{#each data.answers as answer (answer.id)}<AnswerCard {answer} />{/each}</div>
      {/if}
    </section>

    <section class="mt-8">
      <h2 class="mb-3 text-xl font-bold" style="color:var(--ink)">Discussion</h2>
      {#if data.canEngage}
        <form method="POST" action="?/comment" class="mb-4 flex flex-col gap-2">
          <textarea name="body_md" required placeholder="Add a comment (markdown)" rows="3" class="rounded-xl border px-3 py-2" style="border-color:var(--line)"></textarea>
          <button class="self-start rounded-xl px-4 py-2 text-sm font-medium" style="background:var(--ink); color:#fff">Comment</button>
        </form>
      {/if}
      {#if data.comments.length === 0}<p style="color:var(--muted)">No comments yet.</p>{:else}
        <ul class="flex flex-col gap-3">
          {#each data.comments as c (c.id)}
            <li class="rounded-2xl border p-4" style="border-color:var(--line); background:var(--surface)">
              <div class="mb-1 flex items-center justify-between">
                <span class="text-sm" style="color:var(--faint)">{c.author?.display_name ?? c.author?.handle ?? 'Anonymous'}</span>
                {#if data.userId === c.author_id || data.isAdmin}
                  <form method="POST" action="?/delete_comment">
                    <input type="hidden" name="comment_id" value={c.id} />
                    <button class="text-xs" style="color:var(--neg)">Delete</button>
                  </form>
                {/if}
              </div>
              <Markdown html={c.body_html} />
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>

  <aside class="flex flex-col gap-4">
    <BountyMeter potCents={data.pot.pot_cents} funderCount={data.pot.funder_count} currency={data.idea.currency ?? 'USD'} />

    {#if data.canFund}
      <form method="POST" action="?/pledge" class="rounded-2xl border p-4" style="border-color:var(--line); background:var(--surface)">
        <label class="text-xs uppercase tracking-wide" style="color:var(--faint)">Fund this idea ($)
          <input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required class="mt-1 block w-full rounded-xl border px-3 py-2" style="border-color:var(--line)" />
        </label>
        <button class="mt-3 w-full rounded-xl px-4 py-2 text-sm font-medium" style="background:var(--ink); color:#fff">Pledge</button>
        <p class="mt-2 text-xs" style="color:var(--faint)">A pledge is a commitment - no funds move yet.</p>
      </form>
    {/if}

    <div class="rounded-2xl border p-4" style="border-color:var(--line); background:var(--surface)">
      <div class="flex items-baseline justify-between">
        <span class="text-xs uppercase tracking-wide" style="color:var(--faint)">Interested</span>
        <span class="text-sm tabular-nums" style="color:var(--ink)">{data.interestCount}</span>
      </div>
      {#if data.canEngage}
        {#if data.myInterestId}
          <form method="POST" action="?/uninterest" class="mt-2">
            <button class="w-full rounded-xl border px-4 py-2 text-sm" style="border-color:var(--green); color:var(--green-deep)">Interested ✓ - withdraw</button>
          </form>
        {:else}
          <form method="POST" action="?/interest" class="mt-2">
            <button class="w-full rounded-xl px-4 py-2 text-sm font-medium" style="background:var(--ink); color:#fff">I'm interested</button>
          </form>
        {/if}
      {/if}
    </div>

    {#if data.funders.length}
      <div class="rounded-2xl border p-4" style="border-color:var(--line); background:var(--surface)">
        <p class="mb-2 text-xs uppercase tracking-wide" style="color:var(--faint)">Funders</p>
        <ul class="flex flex-col gap-1 text-sm">
          {#each data.funders as f (f.key)}
            <li class="flex justify-between gap-2">
              <span style="color:var(--body)">{f.name}</span>
              <span class="tabular-nums" style="color:var(--ink)"><Money cents={f.amount_cents} currency={f.currency} /></span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if form?.message}<p class="text-sm" style="color:var(--neg)">{form.message}</p>{/if}
  </aside>
</div>
```

- [ ] **Step 4: Verify** `npm run check` (0 errors) + `npm run build` (clean).

- [ ] **Step 5: Commit** `git add src/routes/ideas src/lib/components/AnswerCard.svelte && git commit -m "feat: idea detail - sanitized markdown + comments + interest"`

---

## Task 6: Experts roster - `/experts`

**Files:** `src/routes/experts/+page.server.ts`, `src/routes/experts/+page.svelte`

- [ ] **Step 1: `+page.server.ts`** (public list of approved experts, featured first)

```ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
  const { data: rawExperts } = await supabase
    .from('experts')
    .select('id, specialty, featured, profiles!experts_id_fkey(handle, display_name)')
    .eq('status', 'approved')
    .order('featured', { ascending: false });
  const experts = (rawExperts ?? []).map((e: any) => ({
    id: e.id,
    specialty: e.specialty,
    featured: e.featured,
    profile: Array.isArray(e.profiles) ? (e.profiles[0] ?? null) : e.profiles
  }));
  return { experts };
};
```

- [ ] **Step 2: `+page.svelte`**

```svelte
<script lang="ts">
  let { data } = $props();
</script>
<h1 class="mb-1 text-2xl font-bold" style="color:var(--ink)">Experts</h1>
<p class="mb-6 text-sm" style="color:var(--muted)">Vetted researchers who post bounties on AI Safety Ideas.</p>
{#if data.experts.length === 0}
  <p style="color:var(--muted)">No experts yet.</p>
{:else}
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each data.experts as e (e.id)}
      <a href="/u/{e.profile?.handle}" class="block rounded-2xl border p-5 transition" style="border-color:var(--line); background:var(--surface); box-shadow:var(--shadow-1)">
        <div class="flex items-center justify-between gap-2">
          <h2 class="font-bold" style="color:var(--ink)">{e.profile?.display_name ?? e.profile?.handle ?? 'Expert'}</h2>
          {#if e.featured}<span class="rounded-full px-2 py-0.5 text-xs" style="border:1px solid var(--green); color:var(--green-deep)">Featured</span>{/if}
        </div>
        {#if e.specialty}<p class="mt-1 text-sm" style="color:var(--muted)">{e.specialty}</p>{/if}
      </a>
    {/each}
  </div>
{/if}
```

- [ ] **Step 3: Verify** `npm run check` (0 errors) + `npm run build` (clean).

- [ ] **Step 4: Commit** `git add src/routes/experts && git commit -m "feat: public experts roster at /experts"`

---

## Task 7: Tests - E2E + full suite

**Files:** `e2e/social.spec.ts`

- [ ] **Step 1: E2E `e2e/social.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

// Plan 5's new public surface. The authed comment/interest WRITE path is enforced at the RLS layer (proven by
// pgTAP) and type-checked end-to-end; a full authed browser flow is deferred to the ETL/launch hardening pass.
test('experts roster renders', async ({ page }) => {
  await page.goto('/experts');
  await expect(page.getByRole('heading', { name: 'Experts' })).toBeVisible();
});

test('experts roster is public (no login redirect)', async ({ page }) => {
  await page.goto('/experts');
  await expect(page).toHaveURL(/\/experts$/);
});
```

- [ ] **Step 2: Run the full suite**, in order:
- `npm run check` → 0 errors
- `npx vitest run` → all pass (existing + `renderMarkdown`)
- `supabase test db` → all pgTAP pass (Plans 1–4 + the 18 new Plan-5 assertions)
- `npm run build` → clean
- `npx playwright test` → all pass (free the port first if needed)

- [ ] **Step 3: Commit** - stage only the new test file explicitly (NOT `git add .`, to avoid sweeping in untracked `.claude/settings.json`): `git add e2e/social.spec.ts && git commit -m "test: experts roster + browse E2E"`

---

## Done-when (Plan 5 acceptance)

- `comments` + `interest` exist with RLS; the **18-assertion** pgTAP suite proves: a member comments/expresses-interest only as themselves on a *visible* idea (`legacy_id` **and** non-empty `legacy` both pinned); comments **and** interest on a *draft* idea are not leaked; one interest per member per idea (unique → 23505); a member deletes only their own comment, an **admin** can moderate (delete) any, and a member withdraws only their own interest.
- User-authored Markdown (idea summary, answer explanations, comments, profile bios) renders as **sanitized HTML** via the server-only `renderMarkdown` (`marked` + DOMPurify, `FORBID_TAGS` form-controls + `FORBID_ATTR` style + a `rel=noopener` link hook); the unit test proves `<script>`/`on*`/`javascript:`/`data:` AND the surviving-element boundary (`<img onerror>`) AND form/style injection are all neutralized. The only `{@html}` in the app is `Markdown.svelte` rendering that already-sanitized string. (The plain-text hypothesis `claim` is **not** run through markdown.)
- The idea page has a Discussion section (post a comment + own/**admin**-moderate delete; bodies length-capped) and an Interested toggle + count (idempotent on double-submit).
- `/experts` lists approved experts (featured first), linking to `/u/[handle]`.
- `legacy_id` + `legacy jsonb` carried so the old `comments` + `idea_user_interest_relation` ETL is lossless - **this completes the Phase-1 schema; the one-big ETL is unblocked.**
- All suites green; no secrets; no raw `@html` of unsanitized input; advisors show **no new findings** (`interest.profile_id` is indexed; one policy per command). Per-endpoint rate-limiting (spec §9) stays in the deferred app-wide pass; an inline length cap bounds payloads in the meantime.

**After merge:** controller applies the Plan-5 migration to cloud `gjomchhbsbtauzkpyjwa` via MCP + re-runs advisors. Then the **one-big ETL** (full restore: 265 accounts+emails, 238 ideas, 83 comments, 133 interests, funding/results → the new schema via the `legacy_*` anchors, run as service-role) - to be brainstormed + planned on its own (PII-sensitive: old emails, auth users, password/identity migration). Remaining Phase-1 polish (verify→payout signature animation, app-wide rate-limiting) can follow or fold into the ETL launch.
