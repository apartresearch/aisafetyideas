-- ============ Phase 3 - Stripe intake (test mode) ============
-- Webhook dedupe ledger + customer map + escrow-on-behalf refactor + 'donate' rate bucket.
-- No service-role client: the webhook authenticates as a dedicated system user (is_admin)
-- and calls the admin-only money RPCs. These two tables are admin-only / own-or-admin.

-- ── stripe_events: webhook dedupe ledger (insert-on-receive, replay short-circuits) ──
create table public.stripe_events (
  id         text primary key,            -- Stripe event id (evt_…)
  type       text not null,
  created_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
-- Only the is_admin system user reads/writes (the webhook). No other client touches this.
create policy "stripe_events admin all" on public.stripe_events
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── stripe_customers: profile ↔ Stripe customer map ──
create table public.stripe_customers (
  profile_id         uuid primary key references public.profiles(id) on delete cascade,
  stripe_customer_id text not null,
  created_at         timestamptz not null default now()
);
alter table public.stripe_customers enable row level security;
-- SELECT own-or-admin; writes are admin-only (the webhook / system user).
create policy "stripe_customers select own or admin" on public.stripe_customers
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());
create policy "stripe_customers admin write" on public.stripe_customers
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============ Escrow-on-behalf refactor ============
-- escrow_pledge is self-keyed (auth.uid()), so the system user can't escrow for a donor.
-- Extract the core (keyed to an explicit funder) and delegate. escrow_pledge keeps its exact
-- signature/grants so the 28 Phase-2 tests stay green.

-- 1) _escrow_core: the EXISTING escrow body, keyed to p_funder instead of auth.uid(). Internal only.
create or replace function public._escrow_core(
  p_funder uuid, p_idea uuid, p_amount_cents bigint, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_funding    boolean;
  v_idea       public.ideas;
  v_available  bigint;
  v_funding_id uuid;
  v_entries    jsonb;
begin
  select funding_enabled into v_funding from public.platform_config where id = true;
  if not v_funding then raise exception 'funding is disabled' using errcode = 'P0001'; end if;
  -- idempotency short-circuit
  if p_idempotency_key is not null and exists (
       select 1 from public.ledger_entries where idempotency_key = p_idempotency_key) then
    return null;
  end if;
  if p_amount_cents <= 0 then raise exception 'amount must be positive' using errcode = 'P0001'; end if;
  select * into v_idea from public.ideas where id = p_idea for update;
  if not found then raise exception 'idea not found' using errcode = 'P0002'; end if;
  if v_idea.status <> 'open' then
    raise exception 'idea is not open (status=%)', v_idea.status using errcode = 'P0001'; end if;
  v_available := (select coalesce(sum(amount_cents),0) from public.ledger_entries
                  where profile_id = p_funder and account = 'funder');
  if v_available < p_amount_cents then
    raise exception 'insufficient available balance' using errcode = 'P0001'; end if;
  insert into public.idea_funding (idea_id, funder_id, amount_cents, status)
    values (p_idea, p_funder, p_amount_cents, 'escrowed') returning id into v_funding_id;
  v_entries := jsonb_build_array(
    jsonb_build_object('kind','escrow','account','funder','profile_id', p_funder, 'amount_cents', -p_amount_cents),
    jsonb_build_object('kind','escrow','account','bounty','profile_id', p_funder, 'idea_id', p_idea, 'amount_cents', p_amount_cents)
  );
  perform public.post_ledger(v_entries, p_idempotency_key);
  return v_funding_id;
end; $$;
revoke all on function public._escrow_core(uuid, uuid, bigint, text) from public, anon, authenticated;

-- 2) escrow_pledge: same signature/grants - delegates to _escrow_core keyed on auth.uid().
create or replace function public.escrow_pledge(
  p_idea uuid, p_amount_cents bigint, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'auth required' using errcode = '42501'; end if;
  return public._escrow_core(auth.uid(), p_idea, p_amount_cents, p_idempotency_key);
end; $$;
revoke all on function public.escrow_pledge(uuid, bigint, text) from public, anon;
grant execute on function public.escrow_pledge(uuid, bigint, text) to authenticated;

-- 3) admin_escrow_for: admin/system-user escrows on behalf of an explicit funder (the donor).
create or replace function public.admin_escrow_for(
  p_funder uuid, p_idea uuid, p_amount_cents bigint, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'auth required' using errcode = '42501'; end if;
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return public._escrow_core(p_funder, p_idea, p_amount_cents, p_idempotency_key);
end; $$;
revoke all on function public.admin_escrow_for(uuid, uuid, bigint, text) from public, anon;
grant execute on function public.admin_escrow_for(uuid, uuid, bigint, text) to authenticated;

-- ============ Rate bucket 'donate' ============
-- Copy of the EXISTING consume_rate_limit (latest: 20260608095408_add_ideas_lab.sql) with one new CASE arm.
create or replace function public.consume_rate_limit(p_bucket text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_max int;
  v_window_secs int;
  v_window timestamptz;
  v_count int;
begin
  if v_uid is null then
    return true;   -- anon callers are not tracked here (login uses the app's in-memory limiter)
  end if;

  -- authoritative limit table; keep in sync with BUCKETS in $lib/server/rate-limit.ts
  case p_bucket
    when 'comment'        then v_max := 10;  v_window_secs := 300;
    when 'comment_delete' then v_max := 30;  v_window_secs := 300;
    when 'engage'         then v_max := 60;  v_window_secs := 300;
    when 'pledge'         then v_max := 10;  v_window_secs := 300;
    when 'answer'         then v_max := 5;   v_window_secs := 3600;
    when 'idea_create'    then v_max := 10;  v_window_secs := 3600;
    when 'review'         then v_max := 60;  v_window_secs := 300;
    when 'profile'        then v_max := 10;  v_window_secs := 3600;
    when 'admin'          then v_max := 120; v_window_secs := 300;
    when 'ai_generate'    then v_max := 30;  v_window_secs := 3600;
    when 'donate'         then v_max := 20;  v_window_secs := 3600;
    else raise exception 'unknown rate-limit bucket: %', p_bucket;  -- dev bug → fail-open + logged
  end case;

  v_window := to_timestamp(floor(extract(epoch from now()) / v_window_secs) * v_window_secs);

  -- prune this caller's stale rows for this bucket (definer-owned; no client DELETE path exists)
  delete from public.rate_limits
    where key = 'user:' || v_uid::text and bucket = p_bucket
      and window_start < now() - make_interval(secs => 2 * v_window_secs);

  insert into public.rate_limits as r (key, bucket, window_start)
    values ('user:' || v_uid::text, p_bucket, v_window)
    on conflict (key, bucket, window_start)
    do update set count = r.count + 1
    returning count into v_count;

  return v_count <= v_max;
end $$;

revoke execute on function public.consume_rate_limit(text) from public, anon;
grant execute on function public.consume_rate_limit(text) to authenticated;
