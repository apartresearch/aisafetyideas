begin;
select plan(12);

-- ============ fixtures ============
-- Seed three users; the on_auth_user_created trigger auto-creates their profiles.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','cccc0001-0000-0000-0000-000000000001','authenticated','authenticated','rev_alice@example.com','x', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','cccc0002-0000-0000-0000-000000000002','authenticated','authenticated','rev_bob@example.com','x', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','cccc0003-0000-0000-0000-000000000003','authenticated','authenticated','rev_diana@example.com','x', now(), now(), now());

-- alice = approved expert
insert into public.experts (id, status) values ('cccc0001-0000-0000-0000-000000000001', 'approved');

-- diana = admin
reset role;
update public.profiles set is_admin = true
  where id = 'cccc0003-0000-0000-0000-000000000003';

-- ============ RED proofs / surface checks ============

-- 0a: the moderation RPC exists
select has_function('public', 'admin_moderate_idea', array['uuid','text'],
  '0a: admin_moderate_idea(uuid,text) exists');

-- 0b: the status constraint now accepts 'review'
select lives_ok(
  $$ reset role;
     insert into public.ideas (id, author_id, type, title, status)
       values ('dddd0000-0000-0000-0000-000000000000','cccc0002-0000-0000-0000-000000000002','open_ended','direct review insert','review') $$,
  '0b: status=''review'' is accepted by the ideas_status_check constraint'
);

-- ============ INSERT gate ============

-- 1: non-expert INSERT with status != draft → coerced to review (was archived)
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"cccc0002-0000-0000-0000-000000000002","role":"authenticated"}';

insert into public.ideas (id, author_id, type, title, status)
  values ('dddd0001-0000-0000-0000-000000000001','cccc0002-0000-0000-0000-000000000002','open_ended','bob open','open');
select is(
  (select status from public.ideas where id = 'dddd0001-0000-0000-0000-000000000001'),
  'review',
  '1: non-expert INSERT non-draft → coerced to review'
);

-- 2: non-expert INSERT with status='draft' → stays draft
insert into public.ideas (id, author_id, type, title, status)
  values ('dddd0002-0000-0000-0000-000000000002','cccc0002-0000-0000-0000-000000000002','open_ended','bob draft','draft');
select is(
  (select status from public.ideas where id = 'dddd0002-0000-0000-0000-000000000002'),
  'draft',
  '2: non-expert INSERT draft → stays draft'
);

-- 3: approved-expert INSERT non-draft → stays open
set local "request.jwt.claims" = '{"sub":"cccc0001-0000-0000-0000-000000000001","role":"authenticated"}';
insert into public.ideas (id, author_id, type, title, status)
  values ('dddd0003-0000-0000-0000-000000000003','cccc0001-0000-0000-0000-000000000001','open_ended','alice open','open');
select is(
  (select status from public.ideas where id = 'dddd0003-0000-0000-0000-000000000003'),
  'open',
  '3: approved-expert INSERT non-draft → stays open'
);

-- ============ UPDATE (publish) gate ============

-- 4: non-expert UPDATE draft→open → coerced to review
set local "request.jwt.claims" = '{"sub":"cccc0002-0000-0000-0000-000000000002","role":"authenticated"}';
update public.ideas set status = 'open' where id = 'dddd0002-0000-0000-0000-000000000002';
select is(
  (select status from public.ideas where id = 'dddd0002-0000-0000-0000-000000000002'),
  'review',
  '4: non-expert UPDATE draft→open → coerced to review'
);

-- ============ admin_moderate_idea ============
-- diana (admin) moderates review ideas. Seed three fresh review ideas as bob, then act on each.
set local "request.jwt.claims" = '{"sub":"cccc0002-0000-0000-0000-000000000002","role":"authenticated"}';
insert into public.ideas (id, author_id, type, title, status) values
  ('dddd0010-0000-0000-0000-000000000010','cccc0002-0000-0000-0000-000000000002','open_ended','to approve','open'),
  ('dddd0011-0000-0000-0000-000000000011','cccc0002-0000-0000-0000-000000000002','open_ended','to change','open'),
  ('dddd0012-0000-0000-0000-000000000012','cccc0002-0000-0000-0000-000000000002','open_ended','to reject','open');
-- all three are now status='review' via the insert gate

set local "request.jwt.claims" = '{"sub":"cccc0003-0000-0000-0000-000000000003","role":"authenticated"}';

-- 5: approve → open
select is(
  (select status from public.admin_moderate_idea('dddd0010-0000-0000-0000-000000000010','approve')),
  'open',
  '5: admin_moderate_idea approve → open'
);
-- 6: request_changes → draft
select is(
  (select status from public.admin_moderate_idea('dddd0011-0000-0000-0000-000000000011','request_changes')),
  'draft',
  '6: admin_moderate_idea request_changes → draft'
);
-- 7: reject → archived
select is(
  (select status from public.admin_moderate_idea('dddd0012-0000-0000-0000-000000000012','reject')),
  'archived',
  '7: admin_moderate_idea reject → archived'
);

-- 8: non-admin caller → throws (bob)
set local "request.jwt.claims" = '{"sub":"cccc0002-0000-0000-0000-000000000002","role":"authenticated"}';
-- seed one more review idea for the non-admin attempt
insert into public.ideas (id, author_id, type, title, status)
  values ('dddd0013-0000-0000-0000-000000000013','cccc0002-0000-0000-0000-000000000002','open_ended','nonadmin try','open');
select throws_ok(
  $$ select public.admin_moderate_idea('dddd0013-0000-0000-0000-000000000013','approve') $$,
  '42501',
  'admins only',
  '8: admin_moderate_idea by non-admin → throws 42501'
);

-- 9: admin acting on a non-review idea → throws (dddd0010 is now 'open')
set local "request.jwt.claims" = '{"sub":"cccc0003-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok(
  $$ select public.admin_moderate_idea('dddd0010-0000-0000-0000-000000000010','approve') $$,
  'P0001',
  'idea is not in review (status=open)',
  '9: admin_moderate_idea on a non-review idea → throws P0001'
);

-- 10: unknown action → throws
select throws_ok(
  $$ select public.admin_moderate_idea('dddd0013-0000-0000-0000-000000000013','frobnicate') $$,
  'P0001',
  'unknown moderation action: frobnicate',
  '10: admin_moderate_idea unknown action → throws P0001'
);

select * from finish();
rollback;
