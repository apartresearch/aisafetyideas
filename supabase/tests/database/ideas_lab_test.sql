begin;
select plan(14);

-- ============ fixtures ============
-- Seed four users; the on_auth_user_created trigger auto-creates their profiles.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaa0001-0000-0000-0000-000000000001','authenticated','authenticated','lab_alice@example.com','x', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaa0002-0000-0000-0000-000000000002','authenticated','authenticated','lab_bob@example.com','x', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaa0003-0000-0000-0000-000000000003','authenticated','authenticated','lab_charlie@example.com','x', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaa0004-0000-0000-0000-000000000004','authenticated','authenticated','lab_diana@example.com','x', now(), now(), now());

-- alice = approved expert
insert into public.experts (id, status) values ('aaaa0001-0000-0000-0000-000000000001', 'approved');

-- charlie = active supporter (supporter_until in the future)
update public.profiles set supporter_until = now() + interval '30 days'
  where id = 'aaaa0003-0000-0000-0000-000000000003';

-- diana = admin (no expert record, no supporter_until)
reset role;
update public.profiles set is_admin = true
  where id = 'aaaa0004-0000-0000-0000-000000000004';

-- ============ INSERT gate tests ============

-- 1: non-expert INSERT with status='draft' → stays draft
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaa0002-0000-0000-0000-000000000002","role":"authenticated"}';

insert into public.ideas (id, author_id, type, title, status)
  values ('bbbb0001-0000-0000-0000-000000000001','aaaa0002-0000-0000-0000-000000000002','open_ended','bob draft','draft');
select is(
  (select status from public.ideas where id = 'bbbb0001-0000-0000-0000-000000000001'),
  'draft',
  '1: non-expert INSERT draft → stays draft'
);

-- 2: non-expert INSERT with status != draft → coerced to review
insert into public.ideas (id, author_id, type, title, status)
  values ('bbbb0002-0000-0000-0000-000000000002','aaaa0002-0000-0000-0000-000000000002','open_ended','bob open','open');
select is(
  (select status from public.ideas where id = 'bbbb0002-0000-0000-0000-000000000002'),
  'review',
  '2: non-expert INSERT non-draft → coerced to review'
);

-- 3: approved-expert INSERT with status != draft → stays open
set local "request.jwt.claims" = '{"sub":"aaaa0001-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.ideas (id, author_id, type, title, status)
  values ('bbbb0003-0000-0000-0000-000000000003','aaaa0001-0000-0000-0000-000000000001','open_ended','alice open','open');
select is(
  (select status from public.ideas where id = 'bbbb0003-0000-0000-0000-000000000003'),
  'open',
  '3: approved-expert INSERT non-draft → stays open'
);

-- ============ UPDATE (publish) gate tests ============

-- 4: non-expert UPDATE draft→open → coerced to review
set local "request.jwt.claims" = '{"sub":"aaaa0002-0000-0000-0000-000000000002","role":"authenticated"}';

update public.ideas set status = 'open' where id = 'bbbb0001-0000-0000-0000-000000000001';
select is(
  (select status from public.ideas where id = 'bbbb0001-0000-0000-0000-000000000001'),
  'review',
  '4: non-expert UPDATE draft→open → coerced to review'
);

-- 5: approved-expert UPDATE draft→open → stays open
set local "request.jwt.claims" = '{"sub":"aaaa0001-0000-0000-0000-000000000001","role":"authenticated"}';

-- create an expert draft first
insert into public.ideas (id, author_id, type, title, status)
  values ('bbbb0004-0000-0000-0000-000000000004','aaaa0001-0000-0000-0000-000000000001','open_ended','alice draft','draft');

update public.ideas set status = 'open' where id = 'bbbb0004-0000-0000-0000-000000000004';
select is(
  (select status from public.ideas where id = 'bbbb0004-0000-0000-0000-000000000004'),
  'open',
  '5: approved-expert UPDATE draft→open → stays open'
);

-- ============ can_use_lab_ai() truth table ============

-- 6: approved expert → true
set local "request.jwt.claims" = '{"sub":"aaaa0001-0000-0000-0000-000000000001","role":"authenticated"}';
select ok(public.can_use_lab_ai(), '6: approved expert can use lab AI');

-- 7: plain user (no expert, no supporter) → false
set local "request.jwt.claims" = '{"sub":"aaaa0002-0000-0000-0000-000000000002","role":"authenticated"}';
select ok(not public.can_use_lab_ai(), '7: non-expert non-supporter cannot use lab AI');

-- 8: active supporter → true
set local "request.jwt.claims" = '{"sub":"aaaa0003-0000-0000-0000-000000000003","role":"authenticated"}';
select ok(public.can_use_lab_ai(), '8: active supporter can use lab AI');

-- 9: expired supporter (supporter_until in the past) → false
reset role;
update public.profiles set supporter_until = now() - interval '1 day'
  where id = 'aaaa0003-0000-0000-0000-000000000003';
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaa0003-0000-0000-0000-000000000003","role":"authenticated"}';
select ok(not public.can_use_lab_ai(), '9: expired supporter cannot use lab AI');

-- ============ draft-delete policy tests ============

-- 10: non-expert author can delete their own draft
--     bob already has a draft (bbbb0002 was coerced to review; use a fresh draft)
set local "request.jwt.claims" = '{"sub":"aaaa0002-0000-0000-0000-000000000002","role":"authenticated"}';
insert into public.ideas (id, author_id, type, title, status)
  values ('bbbb0010-0000-0000-0000-000000000010','aaaa0002-0000-0000-0000-000000000002','open_ended','bob draft to delete','draft');

select lives_ok(
  $$ delete from public.ideas where id = 'bbbb0010-0000-0000-0000-000000000010' $$,
  '10: author can delete their own draft idea'
);
select is(
  (select count(*)::int from public.ideas where id = 'bbbb0010-0000-0000-0000-000000000010'),
  0,
  '10b: draft row is gone after author delete'
);

-- 11: author cannot delete a non-draft of theirs (silently 0 rows, no error)
--     bbbb0002 was coerced to review; bob cannot delete it
set local "request.jwt.claims" = '{"sub":"aaaa0002-0000-0000-0000-000000000002","role":"authenticated"}';
delete from public.ideas where id = 'bbbb0002-0000-0000-0000-000000000002';
select is(
  (select count(*)::int from public.ideas where id = 'bbbb0002-0000-0000-0000-000000000002'),
  1,
  '11: author cannot delete a non-draft idea (review row survives)'
);

-- ============ admin override tests ============

-- 12: admin publishing a draft → open (admins bypass the expert check)
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaa0004-0000-0000-0000-000000000004","role":"authenticated"}';

insert into public.ideas (id, author_id, type, title, status)
  values ('bbbb0012-0000-0000-0000-000000000012','aaaa0004-0000-0000-0000-000000000004','open_ended','diana draft','draft');

update public.ideas set status = 'open' where id = 'bbbb0012-0000-0000-0000-000000000012';
select is(
  (select status from public.ideas where id = 'bbbb0012-0000-0000-0000-000000000012'),
  'open',
  '12: admin UPDATE draft→open → stays open (admin bypasses expert check)'
);

-- 13: can_use_lab_ai() returns true for admin (no expert record, no supporter_until)
set local "request.jwt.claims" = '{"sub":"aaaa0004-0000-0000-0000-000000000004","role":"authenticated"}';
select ok(public.can_use_lab_ai(), '13: admin can use lab AI');

select * from finish();
rollback;
