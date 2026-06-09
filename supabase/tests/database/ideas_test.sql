begin;
select plan(9);

-- two users: alice (approved expert), bob (regular)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','alice@example.com','x', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','bob@example.com','x', now(), now(), now());
insert into public.experts (id, status) values ('11111111-1111-1111-1111-111111111111','approved');

-- act as alice (approved expert)
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- 1) approved expert can insert an idea authored by themselves (status 'open')
insert into public.ideas (id, author_id, type, title, status)
  values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','hypothesis','Test idea','open');
select ok((select count(*) from public.ideas) = 1, 'approved expert inserts own idea');

-- 2) expert cannot insert an idea authored by someone else (author_id check)
select throws_ok(
  $$ insert into public.ideas (author_id, title) values ('22222222-2222-2222-2222-222222222222','spoof') $$,
  '42501', null, 'cannot insert idea authored by another user');

-- act as bob (NOT an expert)
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

-- 3a) non-expert CAN insert their own idea (RLS allows authenticated insert own ideas)
select lives_ok(
  $$ insert into public.ideas (id, author_id, type, title, status)
       values ('bbbbbbbb-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','hypothesis','bob idea','open') $$,
  'non-expert can insert own idea');

-- 3b) but the enforce_idea_submission trigger forces it into the review queue
select is(
  (select status from public.ideas where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  'review',
  'non-expert own insert is coerced to review by trigger');

-- 4) bob (authed) can read alice's OPEN idea
select ok((select count(*) from public.ideas where status='open') = 1, 'open idea readable by other users');

-- 5) bob cannot update alice's OPEN idea: 0 rows, no error. Checked while OPEN so bob can still read it.
update public.ideas set title='hacked' where id='aaaaaaaa-0000-0000-0000-000000000001';
select is((select title from public.ideas where id='aaaaaaaa-0000-0000-0000-000000000001'),
  'Test idea', 'non-author cannot update idea');

-- 6) non-admin (bob) cannot insert a category
select throws_ok(
  $$ insert into public.categories (slug, title) values ('x','X') $$,
  '42501', null, 'non-admin cannot insert category');

-- alice drafts her idea
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
update public.ideas set status='draft' where id='aaaaaaaa-0000-0000-0000-000000000001';

-- 7) anon cannot see a draft idea (filter by draft status; archived ideas remain readable)
set local role anon;
select ok((select count(*) from public.ideas where status = 'draft') = 0, 'anon cannot see draft ideas');

-- 8) the author CAN still see their own draft (check by ID)
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select ok(
  exists(select 1 from public.ideas where id = 'aaaaaaaa-0000-0000-0000-000000000001' and status = 'draft'),
  'author sees own draft');

select * from finish();
rollback;
