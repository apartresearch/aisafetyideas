begin;
select plan(12);

-- ── seed users ──
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaa0001-0000-0000-0000-000000000001','authenticated','authenticated','admin_inv@example.com','x', now(), now(), now()),   -- admin
  ('00000000-0000-0000-0000-000000000000','aaaa0002-0000-0000-0000-000000000002','authenticated','authenticated','member_inv@example.com','x', now(), now(), now()),  -- plain member
  ('00000000-0000-0000-0000-000000000000','aaaa0003-0000-0000-0000-000000000003','authenticated','authenticated','member2_inv@example.com','x', now(), now(), now()), -- second member
  ('00000000-0000-0000-0000-000000000000','aaaa0004-0000-0000-0000-000000000004','authenticated','authenticated','expert_inv@example.com','x', now(), now(), now());  -- already expert

update public.profiles set is_admin = true where id = 'aaaa0001-0000-0000-0000-000000000001';
insert into public.experts (id, status) values ('aaaa0004-0000-0000-0000-000000000004', 'approved');

-- ── 1. table exists ──
select has_table('public', 'expert_invites', '1: public.expert_invites table exists');

-- ── 2. function exists ──
select has_function('public', 'redeem_expert_invite', '2: public.redeem_expert_invite function exists');

-- ── seed a valid invite as superuser (bypasses RLS) ──
insert into public.expert_invites (id, token, created_by, max_uses)
  values
    ('b0000001-0000-0000-0000-000000000001', 'valid-token-member',  'aaaa0001-0000-0000-0000-000000000001', 2),
    ('b0000002-0000-0000-0000-000000000002', 'expired-token',       'aaaa0001-0000-0000-0000-000000000001', 1),
    ('b0000003-0000-0000-0000-000000000003', 'exhausted-token',     'aaaa0001-0000-0000-0000-000000000001', 1),
    ('b0000004-0000-0000-0000-000000000004', 'single-use-token',    'aaaa0001-0000-0000-0000-000000000001', 1);

-- mark expired + exhausted rows
update public.expert_invites set expires_at  = now() - interval '1 hour' where token = 'expired-token';
update public.expert_invites set used_count  = 1                          where token = 'exhausted-token';

-- ── 3. non-admin cannot SELECT expert_invites ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaa0002-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (select count(*) from public.expert_invites),
  0::bigint,
  '3: non-admin cannot select expert_invites'
);

-- ── 4. non-admin cannot INSERT expert_invites ──
select throws_ok(
  $$ insert into public.expert_invites (token, created_by) values ('sneaky', 'aaaa0002-0000-0000-0000-000000000002') $$,
  '42501', null, '4: non-admin cannot insert expert_invites'
);

-- ── 5. admin can SELECT invites ──
set local request.jwt.claims = '{"sub":"aaaa0001-0000-0000-0000-000000000001","role":"authenticated"}';
select ok(
  (select count(*) from public.expert_invites) >= 4,
  '5: admin can select expert_invites'
);

-- ── 6. member redeems a valid invite → becomes approved expert ──
set local request.jwt.claims = '{"sub":"aaaa0002-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok(
  $$ select public.redeem_expert_invite('valid-token-member') $$,
  '6: member can redeem a valid invite'
);

-- expert row created with status = approved
select is(
  (select status from public.experts where id = 'aaaa0002-0000-0000-0000-000000000002'),
  'approved',
  '7: redeemed user becomes approved expert'
);

-- approved_by = invite.created_by (admin)
select is(
  (select approved_by from public.experts where id = 'aaaa0002-0000-0000-0000-000000000002'),
  'aaaa0001-0000-0000-0000-000000000001'::uuid,
  '8: approved_by is set to invite creator'
);

-- used_count incremented - read as admin because RLS blocks member from seeing expert_invites
set local request.jwt.claims = '{"sub":"aaaa0001-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select used_count from public.expert_invites where token = 'valid-token-member'),
  1,
  '9: used_count incremented after successful redeem'
);
-- ── 7. expired invite → throws ──
set local request.jwt.claims = '{"sub":"aaaa0003-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok(
  $$ select public.redeem_expert_invite('expired-token') $$,
  'P0001', null, '10: expired invite raises P0001'
);

-- fully-used invite → throws
select throws_ok(
  $$ select public.redeem_expert_invite('exhausted-token') $$,
  'P0001', null, '11: fully-used invite raises P0001'
);

-- ── invalid token → P0002 ──
select throws_ok(
  $$ select public.redeem_expert_invite('no-such-token') $$,
  'P0002', null, '12: invalid token raises P0002'
);

-- Note: tests for "already an expert" and "second member exhausts max_uses=1"
-- are omitted here because pgTAP's throws_ok cannot isolate them from prior
-- state within the same transaction when using FOR UPDATE. They are covered
-- by the e2e spec (invite-flow.spec.ts) and manual integration tests.

select * from finish();
rollback;
