begin;
select plan(21);

-- seed users (handle_new_user trigger creates profiles)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','alice@example.com','x', now(), now(), now()),  -- expert/author
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','bob@example.com','x', now(), now(), now()),    -- funder
  ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333','authenticated','authenticated','carol@example.com','x', now(), now(), now()),  -- funder
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','dave@example.com','x', now(), now(), now());   -- other

insert into public.experts (id, status) values ('11111111-1111-1111-1111-111111111111','approved');
insert into public.ideas (id, author_id, type, title, status) values
  ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','open_ended','Open idea','open'),
  ('a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','open_ended','Draft idea','draft');

set local role authenticated;

-- ===== bob (funder): insert pinning =====
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into public.idea_funding (id, idea_id, funder_id, amount_cents)
  values ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',5000);
select ok((select count(*) from public.idea_funding) = 1, '1: member pledges to an open idea');                                            -- 1
select throws_ok($$ insert into public.idea_funding (idea_id, funder_id, amount_cents, status)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',100,'escrowed') $$,
  '42501', null, '2: cannot self-escrow a pledge on insert');                                                                              -- 2
select throws_ok($$ insert into public.idea_funding (idea_id, funder_id, amount_cents)
  values ('a0000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222',100) $$,
  '42501', null, '3: cannot pledge to a draft idea');                                                                                      -- 3
select throws_ok($$ insert into public.idea_funding (idea_id, funder_id, amount_cents)
  values ('a0000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333',100) $$,
  '42501', null, '4: cannot pledge on behalf of another funder');                                                                          -- 4
select throws_ok($$ insert into public.idea_funding (idea_id, funder_id, amount_cents, legacy_id)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',100,9) $$,
  '42501', null, '5: cannot set legacy_id on a live pledge');                                                                              -- 5
select throws_ok($$ insert into public.idea_funding (idea_id, funder_id, amount_cents)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',100000001) $$,
  '42501', null, '6: cannot pledge above the $1M cap');                                                                                     -- 6
select throws_ok($$ insert into public.idea_funding (idea_id, funder_id, amount_cents, currency)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',100,'EUR') $$,
  '42501', null, '7: cannot pledge in a non-USD currency (Phase 1)');                                                                       -- 7
insert into public.idea_funding (id, idea_id, funder_id, amount_cents)
  values ('f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',3000);
select ok((select count(*) from public.idea_funding) = 2, '8: a funder may top up (multiple pledges)');                                    -- 8
select is((select pot_cents from public.bounty_pot where idea_id='a0000000-0000-0000-0000-000000000001'),
  8000::bigint, '9: bounty_pot sums the funder''s pledges');                                                                              -- 9
select is((select funder_count from public.bounty_pot where idea_id='a0000000-0000-0000-0000-000000000001'),
  1::bigint, '10: top-ups collapse to one distinct funder');                                                                               -- 10

-- ===== carol (second funder) =====
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
insert into public.idea_funding (id, idea_id, funder_id, amount_cents)
  values ('f0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333',2000);
select ok((select count(*) from public.idea_funding) = 3, '11: second funder pledges');                                                    -- 11
select is((select pot_cents from public.bounty_pot where idea_id='a0000000-0000-0000-0000-000000000001'),
  10000::bigint, '12: pot reflects both funders');                                                                                         -- 12
select is((select funder_count from public.bounty_pot where idea_id='a0000000-0000-0000-0000-000000000001'),
  2::bigint, '13: funder_count is distinct funders');                                                                                      -- 13

-- ===== anon: can read public (visible-idea) pledges; cannot insert =====
set local role anon;
select ok((select count(*) from public.idea_funding) = 3, '14: pledges to a visible idea are publicly readable');                          -- 14
select throws_ok($$ insert into public.idea_funding (idea_id, funder_id, amount_cents)
  values ('a0000000-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444',100) $$,
  '42501', null, '15: anon cannot insert a pledge');                                                                                        -- 15

-- ===== seed mixed-status + null-funder + draft pledges as the table owner (bypasses RLS) =====
reset role;
insert into public.idea_funding (id, idea_id, funder_id, amount_cents, status) values
  ('f0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444',5000,'refunded'),
  ('f0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444',7000,'released'),
  ('f0000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444',1500,'escrowed'),
  ('f0000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000002','44444444-4444-4444-4444-444444444444',4000,'committed'),  -- on the DRAFT idea
  ('f0000000-0000-0000-0000-000000000008','a0000000-0000-0000-0000-000000000001', null               ,600 ,'committed');  -- deleted-account funder
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
-- pot includes committed(8000+2000)+escrowed(1500)+null-committed(600)=12100; refunded(5000)+released(7000) excluded
select is((select pot_cents from public.bounty_pot where idea_id='a0000000-0000-0000-0000-000000000001'),
  12100::bigint, '16: pot includes committed+escrowed, excludes refunded+released');                                                       -- 16
-- distinct funders: bob, carol, dave (escrowed), and the null-funder 'anon' bucket = 4
select is((select funder_count from public.bounty_pot where idea_id='a0000000-0000-0000-0000-000000000001'),
  4::bigint, '17: funder_count buckets null funders as anon (survives account deletion)');                                                 -- 17

-- ===== a pledge to a hidden (draft) idea is NOT publicly readable =====
set local role anon;
select is((select count(*) from public.idea_funding where idea_id='a0000000-0000-0000-0000-000000000002'),
  0::bigint, '18: pledges to a draft idea are not leaked to the public');                                                                   -- 18

-- ===== no UPDATE path for clients =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
update public.idea_funding set amount_cents = 999999 where id='f0000000-0000-0000-0000-000000000001';
select is((select amount_cents from public.idea_funding where id='f0000000-0000-0000-0000-000000000001'),
  5000::bigint, '19: no direct client UPDATE on idea_funding');                                                                            -- 19

-- ===== withdraw own committed pledge =====
delete from public.idea_funding where id='f0000000-0000-0000-0000-000000000001';
select ok((select count(*) from public.idea_funding where id='f0000000-0000-0000-0000-000000000001') = 0,
  '20: funder withdraws own committed pledge');                                                                                            -- 20

-- ===== cannot withdraw another funder's pledge =====
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
delete from public.idea_funding where id='f0000000-0000-0000-0000-000000000002';
select is((select count(*) from public.idea_funding where id='f0000000-0000-0000-0000-000000000002'),
  1::bigint, '21: cannot withdraw another funder''s pledge');                                                                              -- 21

select * from finish();
rollback;
