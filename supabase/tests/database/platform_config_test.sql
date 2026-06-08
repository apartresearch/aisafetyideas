begin;
select plan(7);

-- seed users (handle_new_user trigger creates profiles)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','authenticated','authenticated','admin@example.com','x', now(), now(), now()),   -- admin
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','authenticated','authenticated','member@example.com','x', now(), now(), now());  -- regular member

update public.profiles set is_admin = true where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- ===== 1: table exists =====
select has_table('public', 'platform_config', '1: platform_config table exists');                                                              -- 1

-- ===== 2: exactly one row exists (seeded by migration) =====
reset role;
select is((select count(*)::int from public.platform_config), 1, '2: exactly one row exists');                                                 -- 2

-- ===== 3: anon can SELECT (world-readable) =====
set local role anon;
select ok((select fee_bps from public.platform_config where id = true) = 450,
  '3: anon can read the config row and default fee_bps is 450');                                                                               -- 3

-- ===== 4: admin CAN update fee_bps =====
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
update public.platform_config set fee_bps = 500 where id = true;
select is((select fee_bps from public.platform_config where id = true), 500,
  '4: admin can update fee_bps');                                                                                                              -- 4

-- ===== 5: non-admin authenticated user CANNOT update (0 rows affected / silently denied) =====
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
update public.platform_config set fee_bps = 9000 where id = true;
select is((select fee_bps from public.platform_config where id = true), 500,
  '5: non-admin update is silently denied (row unchanged)');                                                                                   -- 5

-- ===== 6: fee_bps check constraint rejects out-of-range value =====
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select throws_ok(
  $$ update public.platform_config set fee_bps = 9999 where id = true $$,
  '23514', null,
  '6: fee_bps check constraint rejects value > 2000');                                                                                        -- 6

-- ===== 7: no INSERT policy — authenticated cannot add a second row =====
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
select throws_ok(
  $$ insert into public.platform_config (id) values (false) $$,
  '42501', null,
  '7: no INSERT policy — authenticated cannot insert rows');                                                                                   -- 7

select * from finish();
rollback;
