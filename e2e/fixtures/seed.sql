-- Reset the per-user RPC rate-limit counters each run so the suite's repeated idea_create/answer/
-- verify actions never trip the limits (answer 5/h, idea_create 10/h) on reruns. Local test DB only.
delete from public.rate_limits;

-- Confirm any e2e users whose email isn't confirmed (no-op if local confirmations are off).
update auth.users set email_confirmed_at = now()
  where email like 'e2e-%@example.com' and email_confirmed_at is null;

-- Approved experts (idea authors). on conflict keeps it idempotent across reruns.
insert into public.experts (id, status)
  select id, 'approved' from auth.users
  where email in ('e2e-expert@example.com', 'e2e-expert2@example.com')
  on conflict (id) do nothing;

-- Admin.
update public.profiles set is_admin = true
  where id = (select id from auth.users where email = 'e2e-admin@example.com');
