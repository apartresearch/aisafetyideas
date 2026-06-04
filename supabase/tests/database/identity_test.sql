begin;
select plan(6);

-- seed two users directly in auth.users (trigger creates their profiles).
-- Include the columns local Supabase auth.users requires (no defaults) to avoid NOT NULL errors.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','alice@example.com','x', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','bob@example.com','x', now(), now(), now());

-- 1) anon CAN read profiles
set local role anon;
select ok( (select count(*) from public.profiles) = 2, 'anon can read all profiles' );

-- 2) anon CANNOT insert a profile (RLS-denied INSERT raises 42501; match on error CODE only)
select throws_ok(
  $$ insert into public.profiles(id, handle) values ('33333333-3333-3333-3333-333333333333','x') $$,
  '42501', null, 'anon cannot insert profile'
);

-- act as alice
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- 3) alice CAN update her own profile
update public.profiles set display_name = 'Alice' where id = '11111111-1111-1111-1111-111111111111';
select ok(
  (select display_name from public.profiles where id='11111111-1111-1111-1111-111111111111') = 'Alice',
  'user updates own profile'
);

-- 4) alice CANNOT update bob's profile (0 rows changed, no error)
update public.profiles set display_name = 'hacked' where id = '22222222-2222-2222-2222-222222222222';
select is(
  (select display_name from public.profiles where id='22222222-2222-2222-2222-222222222222'), null,
  'user cannot update another profile'
);

-- 5) alice CAN apply as a pending expert
insert into public.experts(id, status) values ('11111111-1111-1111-1111-111111111111','pending');
select ok( (select status from public.experts where id='11111111-1111-1111-1111-111111111111')='pending',
  'user can apply as pending expert' );

-- 6) alice CANNOT self-approve: no UPDATE policy for non-admins, so the row is invisible to
--    UPDATE -> 0 rows changed, NO error (RLS denies UPDATE silently). Assert unchanged.
update public.experts set status='approved' where id='11111111-1111-1111-1111-111111111111';
select is(
  (select status from public.experts where id='11111111-1111-1111-1111-111111111111'), 'pending',
  'non-admin cannot approve expert (update silently affects 0 rows)'
);

select * from finish();
rollback;
