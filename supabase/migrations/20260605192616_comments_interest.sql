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
