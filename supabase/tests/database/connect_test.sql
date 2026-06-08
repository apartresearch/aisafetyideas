begin;
select plan(18);

-- ── seed users (handle_new_user trigger creates a profile per auth.users insert) ──
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','expert@example.com','x', now(), now(), now()),  -- E: approved expert / idea author
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','funderA@example.com','x', now(), now(), now()), -- A: funder
  ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333','authenticated','authenticated','submitter@example.com','x', now(), now(), now()),-- S: submitter (gets payable)
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','admin@example.com','x', now(), now(), now());    -- ADMIN

update public.profiles set is_admin = true where id = '44444444-4444-4444-4444-444444444444';
insert into public.experts (id, status) values ('11111111-1111-1111-1111-111111111111','approved');
insert into public.ideas (id, author_id, type, title, status) values
  ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','open_ended','Funded idea','open');

-- ── 1–3: schema existence (RED before migration) ───────────────────────────
select has_table('public', 'stripe_connect_accounts',     '1: stripe_connect_accounts table exists');     -- 1
select has_function('public', 'request_withdrawal',        '2: request_withdrawal exists');                -- 2
select has_function('public', 'admin_mark_paid_offplatform','3: admin_mark_paid_offplatform exists');       -- 3

-- ── Give S a payable balance via the real release flow ──────────────────────
update public.platform_config set funding_enabled = true where id = true;
-- admin credits funder A 10000 (net 9550 @ 450 bps) then A escrows 5000 on the idea
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select public.credit_balance('22222222-2222-2222-2222-222222222222', 10000, 'cw-credit-A');
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select public.escrow_pledge('a0000000-0000-0000-0000-000000000001', 5000, 'cw-escrow-A');
-- S submits, E verifies (payout 3000), admin approves → release fires → S.payable = 3000
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
insert into public.answers (id, idea_id, submitter_id, title)
  values ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','S answer');
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select public.verify_answer('b0000000-0000-0000-0000-000000000001','good', 3000, null);
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select public.admin_approve_payout('b0000000-0000-0000-0000-000000000001','ok');
reset role;
select is((select payable_cents from public.account_balances where profile_id='33333333-3333-3333-3333-333333333333'),
  3000::bigint, '4: S.payable_cents = 3000 (seeded via release)');                                         -- 4

-- ── request_withdrawal: below minimum throws ────────────────────────────────
-- min_withdrawal_cents default = 100; ask for 50 → below minimum.
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select throws_ok($$ select public.request_withdrawal(50, 'wd-below-min') $$,
  'P0001', null, '5: withdrawal below minimum throws');                                                    -- 5

-- ── request_withdrawal: without a payouts_enabled connect row throws ─────────
select throws_ok($$ select public.request_withdrawal(1000, 'wd-no-connect') $$,
  'P0001', null, '6: withdrawal throws without payouts_enabled');                                          -- 6

-- ── Seed a payouts_enabled connect row for S (own insert, then admin flips enabled) ──
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select lives_ok($$ insert into public.stripe_connect_accounts (profile_id, stripe_account_id)
  values ('33333333-3333-3333-3333-333333333333','acct_S') $$,
  '7: S inserts own (not-yet-enabled) connect row');                                                       -- 7
-- own-row insert with payouts_enabled = true is blocked by the INSERT check
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select throws_ok($$ insert into public.stripe_connect_accounts (profile_id, stripe_account_id, payouts_enabled)
  values ('22222222-2222-2222-2222-222222222222','acct_A', true) $$,
  '42501', null, '8: cannot self-insert a payouts_enabled connect row');                                   -- 8
-- admin flips S enabled (the webhook path)
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
update public.stripe_connect_accounts set payouts_enabled = true, onboarding_status = 'enabled'
  where stripe_account_id = 'acct_S';

-- ── request_withdrawal: happy path — S withdraws 2000 ───────────────────────
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select lives_ok($$ select public.request_withdrawal(2000, 'wd-S-1') $$,
  '9: S withdraws 2000 (payouts enabled)');                                                                -- 9
reset role;
select is((select payable_cents from public.account_balances where profile_id='33333333-3333-3333-3333-333333333333'),
  1000::bigint, '10: S.payable_cents = 1000 (3000 - 2000)');                                               -- 10
select is((select coalesce(sum(amount_cents),0)::bigint from public.ledger_entries),
  0::bigint, '11: global ledger sum = 0 after withdrawal');                                                -- 11

-- ── idempotent repeat (same key) → no double-withdrawal ─────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select lives_ok($$ select public.request_withdrawal(2000, 'wd-S-1') $$,
  '12: re-withdraw with the same key is a no-op');                                                          -- 12
reset role;
select is((select payable_cents from public.account_balances where profile_id='33333333-3333-3333-3333-333333333333'),
  1000::bigint, '13: S.payable still 1000 after idempotent repeat');                                       -- 13

-- ── insufficient payable balance → throws ───────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select throws_ok($$ select public.request_withdrawal(999999, 'wd-toomuch') $$,
  'P0001', null, '14: withdrawal throws on insufficient payable');                                         -- 14

-- ── admin_mark_paid_offplatform: non-admin throws ──────────────────────────
select throws_ok($$ select public.admin_mark_paid_offplatform('33333333-3333-3333-3333-333333333333', 500, 'note', 'mp-guard') $$,
  '42501', null, '15: non-admin cannot admin_mark_paid_offplatform');                                      -- 15
-- admin marks S's remaining 1000 paid off-platform
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select lives_ok($$ select public.admin_mark_paid_offplatform('33333333-3333-3333-3333-333333333333', 1000, 'cheque', 'mp-S-1') $$,
  '16: admin marks S''s 1000 paid off-platform');                                                          -- 16
reset role;
select is((select payable_cents from public.account_balances where profile_id='33333333-3333-3333-3333-333333333333'),
  0::bigint, '17: S.payable_cents = 0 after off-platform mark');                                           -- 17

-- ── RLS: a user cannot read another's connect row ──────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.stripe_connect_accounts
     where profile_id='33333333-3333-3333-3333-333333333333'),
  0, '18: a user cannot read another profile''s connect row');                                             -- 18

select * from finish();
rollback;
