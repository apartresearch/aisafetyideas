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
  legacy            jsonb not null default '{}'::jsonb,
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.ideas enable row level security;
create index ideas_author_id_idx on public.ideas (author_id);
create index ideas_status_idx on public.ideas (status);

create policy "ideas readable when not draft" on public.ideas for select using (status <> 'draft');
create policy "authors read own ideas" on public.ideas for select to authenticated
  using ((select auth.uid()) = author_id);
create policy "admins read all ideas" on public.ideas for select to authenticated
  using (public.is_admin());
create policy "approved experts insert own ideas" on public.ideas for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and exists (select 1 from public.experts e
                where e.id = (select auth.uid()) and e.status = 'approved')
  );
create policy "authors update own ideas" on public.ideas for update to authenticated
  using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);
create policy "admins manage ideas" on public.ideas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

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
