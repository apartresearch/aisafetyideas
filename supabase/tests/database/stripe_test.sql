begin;
select plan(11);

-- ── seed users (handle_new_user trigger creates a profile per auth.users insert) ──
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','expert@example.com','x', now(), now(), now()),  -- E: approved expert / idea author
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','funderA@example.com','x', now(), now(), now()), -- A: funder / donor
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','admin@example.com','x', now(), now(), now());    -- ADMIN / system user

update public.profiles set is_admin = true where id = '44444444-4444-4444-4444-444444444444';
-- author must be an approved expert, else the INSERT gate forces the idea to 'archived'
insert into public.experts (id, status) values ('11111111-1111-1111-1111-111111111111','approved');
insert into public.ideas (id, author_id, type, title, status) values
  ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','open_ended','Funded idea','open');

-- ── 1–4: schema existence (RED before migration) ───────────────────────────
select has_table('public', 'stripe_events',    '1: stripe_events table exists');                       -- 1
select has_table('public', 'stripe_customers', '2: stripe_customers table exists');                    -- 2
select has_function('public', 'admin_escrow_for', '3: admin_escrow_for exists');                       -- 3
select has_function('public', '_escrow_core',     '4: _escrow_core exists');                           -- 4

-- ── stripe_customers / stripe_events: a non-admin cannot read others' rows ──
-- Seed a customer row + an event as postgres (no client write path needed for the read test).
reset role;
insert into public.stripe_customers (profile_id, stripe_customer_id) values
  ('11111111-1111-1111-1111-111111111111','cus_expert');
insert into public.stripe_events (id, type) values ('evt_seed','checkout.session.completed');

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.stripe_customers where profile_id='11111111-1111-1111-1111-111111111111'),
  0, '5: non-admin cannot read another profile''s stripe_customers row');                              -- 5
select is((select count(*)::int from public.stripe_events), 0,
  '6: non-admin cannot read stripe_events (admin-only)');                                               -- 6

-- ── consume_rate_limit('donate') does NOT raise for a real authed user ──────
select lives_ok($$ select public.consume_rate_limit('donate') $$,
  '7: consume_rate_limit(''donate'') does not raise');                                                  -- 7
select ok(public.consume_rate_limit('donate'), '8: donate bucket returns true under the limit');       -- 8

-- ── escrow_pledge still works end-to-end (delegation didn't break it) ───────
-- Enable funding, credit A via admin, then A escrows on the open idea.
reset role;
update public.platform_config set funding_enabled = true where id = true;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select public.credit_balance('22222222-2222-2222-2222-222222222222', 10000, 'stripe-credit-A');        -- net 9550 @ 450 bps
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select lives_ok($$ select public.escrow_pledge('a0000000-0000-0000-0000-000000000001', 1000, 'stripe-escrow-A') $$,
  '9: escrow_pledge still works after delegation refactor');                                            -- 9
reset role;
select results_eq(
  $$ select available_cents, escrowed_cents from public.account_balances
     where profile_id='22222222-2222-2222-2222-222222222222' $$,
  $$ values (8550::bigint, 1000::bigint) $$,
  '10: A.available=8550, A.escrowed=1000 after self-escrow');                                            -- 10

-- ── admin_escrow_for: admin escrows on behalf of donor A ────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select lives_ok($$ select public.admin_escrow_for(
    '22222222-2222-2222-2222-222222222222','a0000000-0000-0000-0000-000000000001', 500, 'stripe-escrow-onbehalf') $$,
  '11: admin_escrow_for escrows on behalf of the donor');                                               -- 11

select * from finish();
rollback;
