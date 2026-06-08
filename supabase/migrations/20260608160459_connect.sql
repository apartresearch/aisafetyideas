-- ============ Phase 4 — Payouts (Stripe Connect Express + withdrawals) ============
-- A profile ↔ Stripe Connect (Express) account map, plus two withdrawal RPCs that
-- RESERVE the payout in the ledger before any Stripe Transfer is created (reserve-first:
-- the ledger gates the money). No service-role client: user actions are self-keyed on
-- auth.uid(); the account.updated webhook runs as the system user (is_admin) and flips
-- payouts_enabled via the admin-only UPDATE policy.

-- ── stripe_connect_accounts: profile ↔ Connect Express account ──────────────
create table public.stripe_connect_accounts (
  profile_id        uuid        primary key references public.profiles(id) on delete cascade,
  stripe_account_id text        not null,
  onboarding_status text        not null default 'pending',
  payouts_enabled   boolean     not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.stripe_connect_accounts enable row level security;

-- SELECT: own row or admin.
create policy "connect select own or admin" on public.stripe_connect_accounts
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());

-- INSERT: own row, not-yet-enabled (the onboard route creates the row; payouts_enabled
-- can only ever be flipped true by the admin/system user via the webhook UPDATE policy).
create policy "connect insert own not-enabled" on public.stripe_connect_accounts
  for insert to authenticated
  with check (profile_id = (select auth.uid()) and payouts_enabled = false);

-- UPDATE: admin-only — the account.updated webhook (system user, is_admin) flips payouts_enabled.
create policy "connect admin update" on public.stripe_connect_accounts
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ── Rate buckets 'withdraw' + 'kyc' ─────────────────────────────────────────
-- Copy of the latest consume_rate_limit (20260608155439_stripe.sql, which added 'donate')
-- with two new CASE arms. Keep in sync with BUCKETS in $lib/server/rate-limit.ts.
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
    when 'withdraw'       then v_max := 10;  v_window_secs := 3600;
    when 'kyc'            then v_max := 10;  v_window_secs := 3600;
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

-- ── request_withdrawal: reserve a payable→external withdrawal in the ledger ──
-- Reserve-first: the route creates the Stripe Transfer ONLY after this returns. The ledger
-- gates the payout (insufficient payable / payouts not enabled / below min all throw here).
create or replace function public.request_withdrawal(
  p_amount_cents bigint, p_idempotency_key text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := auth.uid();
  v_funding boolean;
  v_min     bigint;
  v_payable bigint;
  v_entries jsonb;
begin
  if v_uid is null then raise exception 'auth required' using errcode = '42501'; end if;
  select funding_enabled, min_withdrawal_cents into v_funding, v_min
    from public.platform_config where id = true;
  if not v_funding then raise exception 'funding is disabled' using errcode = 'P0001'; end if;
  -- idempotency short-circuit (a retried withdrawal with the same key is a safe no-op)
  if p_idempotency_key is not null and exists (
       select 1 from public.ledger_entries where idempotency_key = p_idempotency_key) then
    return;
  end if;
  if p_amount_cents < v_min then
    raise exception 'below minimum withdrawal' using errcode = 'P0001'; end if;
  v_payable := (select coalesce(sum(amount_cents),0) from public.ledger_entries
                where profile_id = v_uid and account = 'payable');
  if v_payable < p_amount_cents then
    raise exception 'insufficient payable balance' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.stripe_connect_accounts
                 where profile_id = v_uid and payouts_enabled = true) then
    raise exception 'payouts not enabled — complete onboarding' using errcode = 'P0001'; end if;
  v_entries := jsonb_build_array(
    jsonb_build_object('kind','withdrawal','account','payable','profile_id', v_uid, 'amount_cents', -p_amount_cents),
    jsonb_build_object('kind','withdrawal','account','external','amount_cents', p_amount_cents)
  );
  perform public.post_ledger(v_entries, p_idempotency_key);
end; $$;
revoke all on function public.request_withdrawal(bigint, text) from public, anon;
grant execute on function public.request_withdrawal(bigint, text) to authenticated;

-- ── admin_mark_paid_offplatform: admin records a payable grant paid outside Stripe ──
create or replace function public.admin_mark_paid_offplatform(
  p_profile uuid, p_amount_cents bigint, p_note text, p_idempotency_key text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := auth.uid();
  v_payable bigint;
  v_entries jsonb;
begin
  if v_uid is null then raise exception 'auth required' using errcode = '42501'; end if;
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  -- idempotency short-circuit
  if p_idempotency_key is not null and exists (
       select 1 from public.ledger_entries where idempotency_key = p_idempotency_key) then
    return;
  end if;
  v_payable := (select coalesce(sum(amount_cents),0) from public.ledger_entries
                where profile_id = p_profile and account = 'payable');
  if v_payable < p_amount_cents then
    raise exception 'insufficient payable balance' using errcode = 'P0001'; end if;
  v_entries := jsonb_build_array(
    jsonb_build_object('kind','withdrawal','account','payable','profile_id', p_profile, 'amount_cents', -p_amount_cents, 'note', p_note),
    jsonb_build_object('kind','withdrawal','account','external','amount_cents', p_amount_cents, 'note', p_note)
  );
  perform public.post_ledger(v_entries, p_idempotency_key);
end; $$;
revoke all on function public.admin_mark_paid_offplatform(uuid, bigint, text, text) from public, anon;
grant execute on function public.admin_mark_paid_offplatform(uuid, bigint, text, text) to authenticated;
