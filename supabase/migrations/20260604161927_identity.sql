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
