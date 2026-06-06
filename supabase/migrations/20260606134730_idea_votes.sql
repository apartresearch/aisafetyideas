-- ============ idea_votes (one up/down vote per member per idea; toggle = delete + re-insert) ============
create table public.idea_votes (
  id         uuid primary key default gen_random_uuid(),
  legacy_id  bigint unique,
  idea_id    uuid not null references public.ideas(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade, -- a vote without a voter is meaningless
  value      smallint not null check (value in (-1, 1)),
  legacy     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (idea_id, profile_id)
);
alter table public.idea_votes enable row level security;
create index idea_votes_idea_id_idx on public.idea_votes (idea_id);
create index idea_votes_profile_id_idx on public.idea_votes (profile_id);

-- SELECT: readable when the idea is visible (leverages ideas RLS) OR it is the caller's own vote
create policy "votes readable when idea visible or own" on public.idea_votes for select
  using (
    (select auth.uid()) = profile_id
    or exists (select 1 from public.ideas i where i.id = idea_id)
  );
-- INSERT: a member casts their OWN vote on a visible idea; legacy pinned (service-role-only)
create policy "members vote on visible ideas" on public.idea_votes for insert to authenticated
  with check (
    (select auth.uid()) = profile_id
    and legacy_id is null and legacy = '{}'::jsonb
    and exists (select 1 from public.ideas i where i.id = idea_id)
  );
-- DELETE: a member removes their own vote
create policy "member removes own vote" on public.idea_votes for delete to authenticated
  using ((select auth.uid()) = profile_id);
-- NOTE: no UPDATE policy — switching a vote is delete + re-insert (same toggle pattern as interest).

-- ============ idea_vote_totals (security_invoker: respects the caller's idea visibility) ============
create view public.idea_vote_totals
  with (security_invoker = true) as
  select
    idea_id,
    coalesce(sum(value), 0)::bigint           as score,
    count(*) filter (where value = 1)         as up_count,
    count(*) filter (where value = -1)        as down_count
  from public.idea_votes
  group by idea_id;
grant select on public.idea_vote_totals to anon, authenticated;   -- mirrors bounty_pot (idea_funding migration)
