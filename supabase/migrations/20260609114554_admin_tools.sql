-- ============ Admin tools — role management + stats ============
-- All SECURITY DEFINER, set search_path = '', fully-qualified. Internal is_admin()
-- guard carries all authority (no service-role client anywhere). Counts in the
-- stats RPC are DEFINER so they span all rows regardless of RLS.

-- ── 1. admin_set_expert: admin upserts a target's experts row to approved/revoked. ──
create or replace function public.admin_set_expert(p_profile uuid, p_approved boolean)
returns public.experts language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v     public.experts;
begin
  if v_uid is null then raise exception 'auth required' using errcode = '42501'; end if;
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if p_approved then
    insert into public.experts (id, status, approved_by, approved_at)
      values (p_profile, 'approved', v_uid, now())
      on conflict (id) do update
        set status = 'approved', approved_by = v_uid, approved_at = now()
      returning * into v;
  else
    -- revoke: if a row exists flip it to revoked; if none exists this is a no-op
    -- success that simply records a revoked row so the state is explicit.
    insert into public.experts (id, status)
      values (p_profile, 'revoked')
      on conflict (id) do update set status = 'revoked'
      returning * into v;
  end if;
  return v;
end; $$;
revoke all on function public.admin_set_expert(uuid, boolean) from public, anon;
grant execute on function public.admin_set_expert(uuid, boolean) to authenticated;

-- ── 2. admin_set_admin: admin toggles another profile's is_admin flag. ──
-- Self-lockout guard: an admin cannot remove their own admin rights.
create or replace function public.admin_set_admin(p_profile uuid, p_is_admin boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'auth required' using errcode = '42501'; end if;
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if p_profile = v_uid and p_is_admin = false then
    raise exception 'cannot remove your own admin rights' using errcode = 'P0001';
  end if;
  update public.profiles set is_admin = p_is_admin where id = p_profile;
end; $$;
revoke all on function public.admin_set_admin(uuid, boolean) from public, anon;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;

-- ── 3. admin_dashboard_stats: aggregate platform stats as jsonb (admin-only). ──
create or replace function public.admin_dashboard_stats()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := auth.uid();
  v_payable bigint := 0;
  v_treasury bigint := 0;
begin
  if v_uid is null then raise exception 'auth required' using errcode = '42501'; end if;
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;

  if to_regclass('public.ledger_entries') is not null then
    select coalesce(sum(amount_cents) filter (where account = 'payable'), 0),
           coalesce(sum(amount_cents) filter (where account = 'platform_treasury'), 0)
      into v_payable, v_treasury
      from public.ledger_entries;
  end if;

  return jsonb_build_object(
    'ideas', jsonb_build_object(
      'draft',    (select count(*) from public.ideas where status = 'draft'),
      'review',   (select count(*) from public.ideas where status = 'review'),
      'open',     (select count(*) from public.ideas where status = 'open'),
      'resolved', (select count(*) from public.ideas where status = 'resolved'),
      'closed',   (select count(*) from public.ideas where status = 'closed'),
      'archived', (select count(*) from public.ideas where status = 'archived'),
      'review_queue', (select count(*) from public.ideas where status = 'review')
    ),
    'users', jsonb_build_object(
      'total_profiles',  (select count(*) from public.profiles),
      'experts_approved',(select count(*) from public.experts where status = 'approved'),
      'experts_pending', (select count(*) from public.experts where status = 'pending'),
      'admins',          (select count(*) from public.profiles where is_admin)
    ),
    'answers', jsonb_build_object(
      'total',          (select count(*) from public.answers),
      'submitted',      (select count(*) from public.answers where status = 'submitted'),
      'under_review',   (select count(*) from public.answers where status = 'under_review'),
      'verified',       (select count(*) from public.answers where status = 'verified'),
      'rejected',       (select count(*) from public.answers where status = 'rejected'),
      'admin_approved', (select count(*) from public.answers where admin_approved_at is not null)
    ),
    'funding', jsonb_build_object(
      'pledged_cents',  (select coalesce(sum(amount_cents),0) from public.idea_funding where status = 'committed'),
      'escrowed_cents', (select coalesce(sum(amount_cents),0) from public.idea_funding where status = 'escrowed'),
      'released_cents', (select coalesce(sum(amount_cents),0) from public.idea_funding where status = 'released'),
      'refunded_cents', (select coalesce(sum(amount_cents),0) from public.idea_funding where status = 'refunded'),
      'payable_cents',  v_payable,
      'platform_treasury_cents', v_treasury
    )
  );
end; $$;
revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;
