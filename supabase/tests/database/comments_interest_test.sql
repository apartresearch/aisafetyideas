begin;
select plan(18);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','alice@example.com','x', now(), now(), now()),  -- author/expert
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','bob@example.com','x', now(), now(), now()),    -- member
  ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333','authenticated','authenticated','carol@example.com','x', now(), now(), now()),  -- admin
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','dave@example.com','x', now(), now(), now());

update public.profiles set is_admin = true where id = '33333333-3333-3333-3333-333333333333';
insert into public.experts (id, status) values ('11111111-1111-1111-1111-111111111111','approved');
insert into public.ideas (id, author_id, type, title, status) values
  ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','open_ended','Open idea','open'),
  ('a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','open_ended','Draft idea','draft');

set local role authenticated;

-- ===== bob comments + expresses interest (insert pinning) =====
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into public.comments (id, idea_id, author_id, body_md)
  values ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Nice idea');
select ok((select count(*) from public.comments) = 1, '1: member comments on a visible idea');                                              -- 1
select throws_ok($$ insert into public.comments (idea_id, author_id, body_md)
  values ('a0000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','spoof') $$,
  '42501', null, '2: cannot comment as another author');                                                                                    -- 2
select throws_ok($$ insert into public.comments (idea_id, author_id, body_md)
  values ('a0000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','on draft') $$,
  '42501', null, '3: cannot comment on a draft idea');                                                                                      -- 3
select throws_ok($$ insert into public.comments (idea_id, author_id, body_md, legacy_id)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','squat',7) $$,
  '42501', null, '4: cannot set legacy_id on a live comment');                                                                              -- 4
select throws_ok($$ insert into public.comments (idea_id, author_id, body_md, legacy)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','squat','{"a":1}'::jsonb) $$,
  '42501', null, '5: cannot set a non-empty legacy on a live comment');                                                                     -- 5
insert into public.interest (id, idea_id, profile_id, note_md)
  values ('d0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','keen');
select ok((select count(*) from public.interest) = 1, '6: member expresses interest');                                                     -- 6
select throws_ok($$ insert into public.interest (idea_id, profile_id)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222') $$,
  '23505', null, '7: one interest per member per idea (unique)');                                                                           -- 7
select throws_ok($$ insert into public.interest (idea_id, profile_id)
  values ('a0000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333') $$,
  '42501', null, '8: cannot express interest on behalf of another');                                                                        -- 8
select throws_ok($$ insert into public.interest (idea_id, profile_id, legacy)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','{"a":1}'::jsonb) $$,
  '42501', null, '9: cannot set a non-empty legacy on a live interest');                                                                    -- 9

-- ===== anon can read comments/interest on a visible idea =====
set local role anon;
select ok((select count(*) from public.comments) = 1, '10: comments are publicly readable on a visible idea');                             -- 10
select ok((select count(*) from public.interest) = 1, '11: interest is publicly readable on a visible idea');                              -- 11

-- ===== draft-idea comment AND interest are not leaked (seed both as owner, bypass RLS) =====
reset role;
insert into public.comments (id, idea_id, author_id, body_md)
  values ('c0000000-0000-0000-0000-000000000009','a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','draft comment');
insert into public.interest (id, idea_id, profile_id)
  values ('d0000000-0000-0000-0000-000000000009','a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111');
set local role anon;
select is((select count(*) from public.comments where idea_id='a0000000-0000-0000-0000-000000000002'),
  0::bigint, '12: comments on a draft idea are not leaked to the public');                                                                  -- 12
select is((select count(*) from public.interest where idea_id='a0000000-0000-0000-0000-000000000002'),
  0::bigint, '13: interest on a draft idea is not leaked to the public');                                                                   -- 13

-- ===== delete: non-author can't; admin can (moderation); author can delete own =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';  -- dave
delete from public.comments where id='c0000000-0000-0000-0000-000000000001';
select is((select count(*) from public.comments where id='c0000000-0000-0000-0000-000000000001'),
  1::bigint, '14: a non-author/non-admin cannot delete a comment');                                                                        -- 14
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';  -- admin carol
delete from public.comments where id='c0000000-0000-0000-0000-000000000001';
select ok((select count(*) from public.comments where id='c0000000-0000-0000-0000-000000000001') = 0,
  '15: an admin can delete a comment (moderation)');                                                                                       -- 15
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';  -- bob
insert into public.comments (id, idea_id, author_id, body_md)
  values ('c0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','my own');
delete from public.comments where id='c0000000-0000-0000-0000-000000000002';
select ok((select count(*) from public.comments where id='c0000000-0000-0000-0000-000000000002') = 0,
  '16: an author can delete their own comment');                                                                                           -- 16

-- ===== interest: cannot withdraw another's; can withdraw own =====
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';  -- dave
delete from public.interest where id='d0000000-0000-0000-0000-000000000001';
select is((select count(*) from public.interest where id='d0000000-0000-0000-0000-000000000001'),
  1::bigint, '17: a member cannot withdraw another member''s interest');                                                                   -- 17
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';  -- bob
delete from public.interest where id='d0000000-0000-0000-0000-000000000001';
select ok((select count(*) from public.interest where id='d0000000-0000-0000-0000-000000000001') = 0,
  '18: a member withdraws their own interest');                                                                                            -- 18

select * from finish();
rollback;
