begin;
select plan(15);

-- ── seed users ──
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aabb0001-0000-0000-0000-000000000001','authenticated','authenticated','admin_at@example.com','x', now(), now(), now()),   -- admin
  ('00000000-0000-0000-0000-000000000000','aabb0002-0000-0000-0000-000000000002','authenticated','authenticated','member_at@example.com','x', now(), now(), now()),  -- plain member
  ('00000000-0000-0000-0000-000000000000','aabb0003-0000-0000-0000-000000000003','authenticated','authenticated','member2_at@example.com','x', now(), now(), now()); -- second member

update public.profiles set is_admin = true where id = 'aabb0001-0000-0000-0000-000000000001';

-- ── 1-3. functions exist (RED proof) ──
select has_function('public', 'admin_set_expert', array['uuid','boolean'], '1: admin_set_expert exists');
select has_function('public', 'admin_set_admin', array['uuid','boolean'], '2: admin_set_admin exists');
select has_function('public', 'admin_dashboard_stats', '3: admin_dashboard_stats exists');

-- act as admin
set local role authenticated;
set local request.jwt.claims = '{"sub":"aabb0001-0000-0000-0000-000000000001","role":"authenticated"}';

-- ── 4. admin_set_expert(u,true) → approved ──
select lives_ok(
  $$ select public.admin_set_expert('aabb0002-0000-0000-0000-000000000002', true) $$,
  '4: admin can make a user an expert');
select is(
  (select status from public.experts where id = 'aabb0002-0000-0000-0000-000000000002'),
  'approved', '5: target is approved expert');

-- ── 6. admin_set_expert(u,false) → revoked ──
select lives_ok(
  $$ select public.admin_set_expert('aabb0002-0000-0000-0000-000000000002', false) $$,
  '6: admin can revoke expert');
select is(
  (select status from public.experts where id = 'aabb0002-0000-0000-0000-000000000002'),
  'revoked', '7: target is revoked expert');

-- ── 8. admin_set_admin(u,true) → is_admin true ──
select lives_ok(
  $$ select public.admin_set_admin('aabb0002-0000-0000-0000-000000000002', true) $$,
  '8: admin can grant admin');
select is(
  (select is_admin from public.profiles where id = 'aabb0002-0000-0000-0000-000000000002'),
  true, '9: target is now admin');
-- and (u,false) → false
select public.admin_set_admin('aabb0002-0000-0000-0000-000000000002', false);
select is(
  (select is_admin from public.profiles where id = 'aabb0002-0000-0000-0000-000000000002'),
  false, '10: target admin removed');

-- ── 11. self-lockout guard ──
select throws_ok(
  $$ select public.admin_set_admin('aabb0001-0000-0000-0000-000000000001', false) $$,
  'P0001', null, '11: cannot remove own admin rights');

-- ── 12. admin_dashboard_stats returns expected jsonb structure ──
select ok(
  (public.admin_dashboard_stats() -> 'ideas') ? 'review'
  and (public.admin_dashboard_stats() -> 'users') ? 'admins'
  and (public.admin_dashboard_stats() -> 'answers') ? 'verified'
  and (public.admin_dashboard_stats() -> 'funding') ? 'pledged_cents'
  and jsonb_typeof(public.admin_dashboard_stats() -> 'ideas' -> 'review_queue') = 'number',
  '12: admin_dashboard_stats jsonb has ideas/users/answers/funding keys');

-- ── act as non-admin member ──
set local request.jwt.claims = '{"sub":"aabb0003-0000-0000-0000-000000000003","role":"authenticated"}';

-- ── 13. non-admin cannot call admin RPCs ──
select throws_ok(
  $$ select public.admin_set_expert('aabb0003-0000-0000-0000-000000000003', true) $$,
  '42501', null, '13: non-admin cannot set expert');
select throws_ok(
  $$ select public.admin_set_admin('aabb0003-0000-0000-0000-000000000003', true) $$,
  '42501', null, '14a: non-admin cannot set admin');
select throws_ok(
  $$ select public.admin_dashboard_stats() $$,
  '42501', null, '14: non-admin cannot read stats');

select * from finish();
rollback;
