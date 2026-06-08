-- Phase 7: earnings view + notification email lookup

-- ── lookup_notification_email ──────────────────────────────────────────────────
-- Admin-only; reads auth.users (private schema) as DEFINER.
create or replace function public.lookup_notification_email(p_profile uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_email text;
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  select email into v_email from auth.users where id = p_profile;
  return v_email;
end; $$;

revoke all on function public.lookup_notification_email(uuid) from public, anon;
grant execute on function public.lookup_notification_email(uuid) to authenticated;

-- ── profile_earnings ───────────────────────────────────────────────────────────
-- World-readable aggregate view: lifetime released grants per profile.
-- Runs as the view owner (postgres), so it aggregates across all ledger rows;
-- only per-profile totals are exposed — never individual entries.
-- Withdrawals (kind='withdrawal') do NOT reduce lifetime_cents.
create view public.profile_earnings as
select profile_id,
  coalesce(sum(amount_cents), 0)::bigint as lifetime_cents,
  count(distinct answer_id)::int          as payout_count
from public.ledger_entries
where account = 'payable' and kind = 'release' and amount_cents > 0
group by profile_id;

grant select on public.profile_earnings to anon, authenticated;
