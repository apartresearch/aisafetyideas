begin;
select plan(17);

-- ── seed users (trigger creates profiles) ──────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','authenticated','authenticated','alice@example.com','x', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','authenticated','authenticated','bob@example.com','x', now(), now(), now());

insert into public.ideas (id, author_id, type, title, status)
  values ('c0000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','open_ended','Test idea','open');

-- ── 1–3: schema existence ───────────────────────────────────────────────────
select has_table('public', 'ledger_entries', '1: ledger_entries table exists');                                        -- 1
select has_view('public', 'account_balances', '2: account_balances view exists');                                      -- 2
select has_function('public', 'post_ledger', '3: post_ledger function exists');                                        -- 3

-- ── 4: balanced post works + view math ─────────────────────────────────────
-- post as postgres (superuser) since post_ledger is not callable by clients
reset role;
select public.post_ledger(
  '[
    {"kind":"donation","account":"external","amount_cents":-1100},
    {"kind":"donation","account":"funder","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","amount_cents":1000},
    {"kind":"donation","account":"platform_treasury","amount_cents":100}
  ]'::jsonb,
  'idem-test-1'
);
-- funder leg: available_cents = +1000; escrowed = 0; payable = 0
select results_eq(
  $$ select available_cents, escrowed_cents, payable_cents
     from public.account_balances
     where profile_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  $$ values (1000::bigint, 0::bigint, 0::bigint) $$,
  '4: donation leg shows available_cents=1000, escrowed=0, payable=0'
);                                                                                                                      -- 4

-- ── 5: escrow moves funder→bounty correctly ─────────────────────────────────
select public.post_ledger(
  '[
    {"kind":"escrow","account":"funder","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","idea_id":"c0000000-0000-0000-0000-000000000001","amount_cents":-600},
    {"kind":"escrow","account":"bounty","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","idea_id":"c0000000-0000-0000-0000-000000000001","amount_cents":600}
  ]'::jsonb,
  'idem-test-2'
);
select results_eq(
  $$ select available_cents, escrowed_cents, payable_cents
     from public.account_balances
     where profile_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  $$ values (400::bigint, 600::bigint, 0::bigint) $$,
  '5: after escrow: available=400, escrowed=600, payable=0'
);                                                                                                                      -- 5

-- ── 6: unbalanced post raises ────────────────────────────────────────────────
select throws_ok(
  $$ select public.post_ledger('[
    {"kind":"escrow","account":"funder","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","amount_cents":-500},
    {"kind":"escrow","account":"bounty","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","amount_cents":400}
  ]'::jsonb) $$,
  'P0001', null, '6: unbalanced transaction raises exception'
);                                                                                                                      -- 6

-- ── 7: fewer than 2 legs raises ──────────────────────────────────────────────
select throws_ok(
  $$ select public.post_ledger('[
    {"kind":"escrow","account":"funder","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","amount_cents":0}
  ]'::jsonb) $$,
  'P0001', null, '7: single-leg transaction raises exception'
);                                                                                                                      -- 7

-- ── 8: idempotency — re-posting same key is a no-op ──────────────────────────
select is(
  (select count(*) from public.ledger_entries where idempotency_key = 'idem-test-1')::int,
  1,
  '8a: idempotency_key appears on exactly first leg'
);                                                                                                                      -- 8

-- count rows before re-post
-- (there should be 5 total rows so far: 3 from idem-test-1, 2 from idem-test-2)
select is(
  (select count(*) from public.ledger_entries)::int,
  5,
  '8b: total rows before idempotent re-post = 5'
);                                                                                                                      -- 9  (counts as plan assertion)

select public.post_ledger(
  '[
    {"kind":"donation","account":"external","amount_cents":-1100},
    {"kind":"donation","account":"funder","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","amount_cents":1000},
    {"kind":"donation","account":"platform_treasury","amount_cents":100}
  ]'::jsonb,
  'idem-test-1'   -- same key → no-op
);
select is(
  (select count(*) from public.ledger_entries)::int,
  5,
  '8c: idempotent re-post inserts nothing (row count unchanged)'
);                                                                                                                      -- 10

-- ── 9: client cannot INSERT directly ────────────────────────────────────────
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select throws_ok(
  $$ insert into public.ledger_entries
       (kind, account, profile_id, amount_cents, currency)
     values ('escrow','funder','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',100,'USD') $$,
  '42501', null, '9: authenticated cannot INSERT into ledger_entries directly'
);                                                                                                                      -- 11

-- ── 10: client cannot UPDATE directly ───────────────────────────────────────
-- reset to superuser to fetch a real id first
reset role;
do $$
declare v_id uuid;
begin
  select id into v_id from public.ledger_entries limit 1;
  execute format(
    'set local "test.ledger_id" = %L', v_id::text
  );
end $$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

-- update should silently match 0 rows (RLS deny = no matching rows for authenticated)
with upd as (
  update public.ledger_entries set note = 'hacked'
  where profile_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  returning 1
)
select is((select count(*) from upd)::int, 0,
  '10: authenticated UPDATE matches 0 rows (no RLS write policy)'
);                                                                                                                      -- 12

-- ── 11: client cannot DELETE directly ───────────────────────────────────────
with del as (
  delete from public.ledger_entries
  where profile_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  returning 1
)
select is((select count(*) from del)::int, 0,
  '11: authenticated DELETE matches 0 rows (no RLS write policy)'
);                                                                                                                      -- 13

-- ── 12: RLS read isolation — alice cannot see bob's rows ─────────────────────
reset role;
-- post some ledger entries for bob as superuser
select public.post_ledger(
  '[
    {"kind":"donation","account":"external","amount_cents":-500},
    {"kind":"donation","account":"funder","profile_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","amount_cents":450},
    {"kind":"donation","account":"platform_treasury","amount_cents":50}
  ]'::jsonb,
  'idem-bob-1'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

-- alice should NOT see bob's entries
select is(
  (select count(*) from public.ledger_entries
   where profile_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')::int,
  0,
  '12: alice cannot SELECT bob''s ledger rows'
);                                                                                                                      -- 14

-- alice CAN see her own entries
select ok(
  (select count(*) from public.ledger_entries
   where profile_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') > 0,
  '13: alice can SELECT her own ledger rows'
);                                                                                                                      -- 15

-- ── 14: balance correctness — multi-leg scenario ────────────────────────────
-- alice current state (from tests 4+5 above): available=400, escrowed=600
-- now post a release: bounty -300, payable +300
reset role;
select public.post_ledger(
  '[
    {"kind":"release","account":"bounty","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","idea_id":"c0000000-0000-0000-0000-000000000001","amount_cents":-300},
    {"kind":"release","account":"payable","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","amount_cents":300}
  ]'::jsonb,
  'idem-test-3'
);
-- expected: available=1000-600=400, escrowed=600-300=300, payable=0+300=300
select results_eq(
  $$ select available_cents, escrowed_cents, payable_cents
     from public.account_balances
     where profile_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  $$ values (400::bigint, 300::bigint, 300::bigint) $$,
  '14: after release: available=400, escrowed=300, payable=300'
);                                                                                                                      -- 16

-- ── 15: idempotency_key on first leg only ───────────────────────────────────
-- verify that non-first legs of idem-test-2 have null idempotency_key
select is(
  (select count(*) from public.ledger_entries
   where idempotency_key is null
     and kind = 'escrow')::int,
  1,
  '15: non-first legs of a transaction have null idempotency_key'
);                                                                                                                      -- 17

select * from finish();
rollback;
