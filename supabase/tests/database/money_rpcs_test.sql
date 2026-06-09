begin;
select plan(28);

-- ── seed users (handle_new_user trigger creates a profile per auth.users insert) ──
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','expert@example.com','x', now(), now(), now()),  -- E: approved expert / idea author
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','funderA@example.com','x', now(), now(), now()), -- A: funder
  ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333','authenticated','authenticated','submitter@example.com','x', now(), now(), now()),-- S: submitter
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','admin@example.com','x', now(), now(), now()),    -- ADMIN
  ('00000000-0000-0000-0000-000000000000','55555555-5555-5555-5555-555555555555','authenticated','authenticated','funderB@example.com','x', now(), now(), now());  -- B: second funder

update public.profiles set is_admin = true where id = '44444444-4444-4444-4444-444444444444';
insert into public.experts (id, status) values ('11111111-1111-1111-1111-111111111111','approved');
insert into public.ideas (id, author_id, type, title, status) values
  ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','open_ended','Funded idea','open');

-- ── 1: schema existence (RED before migration) ──────────────────────────────
select has_function('public', 'credit_balance',          '1: credit_balance exists');                  -- 1
select has_function('public', 'escrow_pledge',           '2: escrow_pledge exists');                   -- 2
select has_function('public', 'release_grant',           '3: release_grant exists');                   -- 3
select has_function('public', 'refund_funder',           '4: refund_funder exists');                   -- 4
select has_function('public', 'admin_credit_offplatform','5: admin_credit_offplatform exists');        -- 5

set local role authenticated;

-- ── credit_balance: role guard (non-admin → throws) ─────────────────────────
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select throws_ok($$ select public.credit_balance('22222222-2222-2222-2222-222222222222', 10000, 'credit-A-guard') $$,
  '42501', null, '6: non-admin cannot credit_balance');                                                -- 6

-- ── credit_balance: admin credits funder A 10000 → fee split (450 bps) ───────
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select lives_ok($$ select public.credit_balance('22222222-2222-2222-2222-222222222222', 10000, 'credit-A-1') $$,
  '7: admin credits funder A 10000');                                                                  -- 7
reset role;
select is((select available_cents from public.account_balances where profile_id='22222222-2222-2222-2222-222222222222'),
  9550::bigint, '8: A.available_cents = 9550 (net of 450 bps fee)');                                    -- 8
select is((select coalesce(sum(amount_cents),0)::bigint from public.ledger_entries where account='platform_treasury'),
  450::bigint, '9: platform_treasury total = 450');                                                    -- 9

-- ── credit_balance: idempotency (same key → no-op) ──────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select lives_ok($$ select public.credit_balance('22222222-2222-2222-2222-222222222222', 10000, 'credit-A-1') $$,
  '10: re-credit with same key is a no-op');                                                           -- 10
reset role;
select is((select available_cents from public.account_balances where profile_id='22222222-2222-2222-2222-222222222222'),
  9550::bigint, '11: A.available still 9550 after idempotent re-credit');                              -- 11

-- ── escrow_pledge: requires funding_enabled (currently false) ───────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select throws_ok($$ select public.escrow_pledge('a0000000-0000-0000-0000-000000000001', 1000, 'escrow-A-disabled') $$,
  'P0001', null, '12: escrow throws when funding disabled');                                           -- 12

-- enable funding
reset role;
update public.platform_config set funding_enabled = true where id = true;

-- ── escrow_pledge: insufficient balance ─────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select throws_ok($$ select public.escrow_pledge('a0000000-0000-0000-0000-000000000001', 999999, 'escrow-A-toomuch') $$,
  'P0001', null, '13: escrow throws on insufficient available balance');                               -- 13

-- ── escrow_pledge: happy path - A escrows 5000 ──────────────────────────────
select lives_ok($$ select public.escrow_pledge('a0000000-0000-0000-0000-000000000001', 5000, 'escrow-A-1') $$,
  '14: A escrows 5000');                                                                               -- 14
reset role;
select results_eq(
  $$ select available_cents, escrowed_cents from public.account_balances
     where profile_id='22222222-2222-2222-2222-222222222222' $$,
  $$ values (4550::bigint, 5000::bigint) $$,
  '15: A.available=4550, A.escrowed=5000 after pledge');                                               -- 15
select is((select count(*)::int from public.idea_funding
     where idea_id='a0000000-0000-0000-0000-000000000001' and funder_id='22222222-2222-2222-2222-222222222222'
       and status='escrowed' and amount_cents=5000),
  1, '16: an escrowed idea_funding row exists for A');                                                  -- 16

-- ── Full lifecycle: S submits answer → E verifies → admin approves → release fires ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
insert into public.answers (id, idea_id, submitter_id, title)
  values ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','S answer');
-- E verifies with intended payout 3000
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok($$ select public.verify_answer('b0000000-0000-0000-0000-000000000001','good', 3000, null) $$,
  '17: expert author verifies answer (payout 3000)');                                                  -- 17
-- admin approves the gate → admin_approve_payout fires release_grant
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select lives_ok($$ select public.admin_approve_payout('b0000000-0000-0000-0000-000000000001','charitable ok') $$,
  '18: admin approves gate → release fires');                                                          -- 18
reset role;
select is((select payable_cents from public.account_balances where profile_id='33333333-3333-3333-3333-333333333333'),
  3000::bigint, '19: S.payable_cents = 3000 after release');                                            -- 19
select is((select escrowed_cents from public.account_balances where profile_id='22222222-2222-2222-2222-222222222222'),
  2000::bigint, '20: A.escrowed_cents = 2000 (5000 - 3000 drawn)');                                     -- 20
select is((select status from public.idea_funding
     where idea_id='a0000000-0000-0000-0000-000000000001' and funder_id='22222222-2222-2222-2222-222222222222'),
  'escrowed', '21: A''s funding row still escrowed (partially drawn)');                                 -- 21

-- ── Global balance invariant: Σ over ALL ledger_entries = 0 ─────────────────
select is((select coalesce(sum(amount_cents),0)::bigint from public.ledger_entries),
  0::bigint, '22: global ledger sum = 0 after lifecycle');                                              -- 22

-- ── release_grant role guard (non-admin → throws) ───────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select throws_ok($$ select public.release_grant('b0000000-0000-0000-0000-000000000001', 'release-guard') $$,
  '42501', null, '23: non-admin cannot release_grant');                                                -- 23

-- ── release before approval (admin_approved_at null) → throws ───────────────
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
insert into public.answers (id, idea_id, submitter_id, title)
  values ('b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','Unapproved answer');
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select throws_ok($$ select public.release_grant('b0000000-0000-0000-0000-000000000002', 'release-unapproved') $$,
  'P0001', null, '24: release throws when answer not admin-approved');                                  -- 24

-- ── refund_funder: admin refunds A's remaining escrow on the idea ───────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select lives_ok($$ select public.refund_funder(
    (select id from public.idea_funding
       where idea_id='a0000000-0000-0000-0000-000000000001'
         and funder_id='22222222-2222-2222-2222-222222222222'), 'refund-A-1') $$,
  '25: admin refunds A''s funding row');                                                                -- 25
reset role;
select results_eq(
  $$ select available_cents, escrowed_cents from public.account_balances
     where profile_id='22222222-2222-2222-2222-222222222222' $$,
  $$ values (6550::bigint, 0::bigint) $$,
  '26: A.available=6550 (4550+2000), A.escrowed=0 after refund');                                       -- 26
select is((select status from public.idea_funding
     where idea_id='a0000000-0000-0000-0000-000000000001' and funder_id='22222222-2222-2222-2222-222222222222'),
  'refunded', '27: A''s funding row status = refunded');                                                -- 27
select is((select coalesce(sum(amount_cents),0)::bigint from public.ledger_entries),
  0::bigint, '28: global ledger sum still 0 after refund');                                             -- 28

select * from finish();
rollback;
