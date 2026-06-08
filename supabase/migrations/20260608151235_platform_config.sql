-- ============ platform_config (single-row platform settings; admin-only writes) ============
-- A single-row guard (id boolean primary key default true check (id)) ensures only one row
-- can ever exist. The row is seeded here; no INSERT/DELETE policy exists so clients cannot
-- add or remove rows. Only admins can UPDATE.
create table public.platform_config (
  id                    boolean primary key default true check (id),  -- single-row guard
  fee_bps               int not null default 450 check (fee_bps between 0 and 2000),
  funding_enabled       boolean not null default false,
  min_withdrawal_cents  int not null default 100,
  updated_at            timestamptz not null default now(),
  updated_by            uuid references public.profiles(id)
);

-- Seed the one row (no INSERT policy exists — clients cannot add rows; only this migration does).
insert into public.platform_config (id) values (true);

alter table public.platform_config enable row level security;

-- World-readable: anyone can read the current fee / feature-flags.
create policy "platform_config world readable" on public.platform_config
  for select using (true);

-- Admin-only UPDATE: only profiles with is_admin = true can change config values.
create policy "platform_config admin update" on public.platform_config
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- NOTE: No INSERT or DELETE policy. The single row is seeded above; nobody adds/removes rows.