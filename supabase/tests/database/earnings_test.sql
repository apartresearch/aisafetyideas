begin;
select plan(10);

-- ── seed users ──────────────────────────────────────────────────────────────
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','authenticated','authenticated','submitter@example.com','x', now(), now(), now()),  -- S: submitter
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','authenticated','authenticated','admin@example.com','x', now(), now(), now()),       -- ADMIN
  ('00000000-0000-0000-0000-000000000000','cccccccc-cccc-cccc-cccc-cccccccccccc','authenticated','authenticated','anon2@example.com','x', now(), now(), now());        -- plain user

update public.profiles set is_admin = true where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- insert idea + answer as superuser (RLS bypass) so we control UUIDs
reset role;
insert into public.ideas (id, author_id, type, title, status)
  values ('c0000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','open_ended','Test Idea','open');

-- insert answer as superuser too (matches how money_rpcs_test.sql seeds answers)
insert into public.answers (id, idea_id, submitter_id, title)
  values ('d0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','S answer');

-- ── 1–3: schema / objects exist ──────────────────────────────────────────────
reset role;
select has_function('public', 'lookup_notification_email', '1: lookup_notification_email function exists'); -- 1
select has_view('public', 'profile_earnings', '2: profile_earnings view exists');                          -- 2

-- ── 3: post a release ledger entry for submitter S ────────────────────────────
select public.post_ledger(
  '[
    {"kind":"release","account":"payable","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","answer_id":"d0000000-0000-0000-0000-000000000001","amount_cents":3000},
    {"kind":"release","account":"bounty","idea_id":"c0000000-0000-0000-0000-000000000001","amount_cents":-3000}
  ]'::jsonb,
  'release-k1'
);

select is(
  (select lifetime_cents from public.profile_earnings where profile_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  3000::bigint,
  '3: lifetime_cents = 3000 after first release'
);                                                                                                          -- 3

select is(
  (select payout_count from public.profile_earnings where profile_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1::int,
  '4: payout_count = 1 after first release'
);                                                                                                          -- 4

-- ── 5: post a withdrawal - lifetime_cents must NOT decrease ──────────────────
select public.post_ledger(
  '[
    {"kind":"withdrawal","account":"payable","profile_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","amount_cents":-1000},
    {"kind":"withdrawal","account":"external","amount_cents":1000}
  ]'::jsonb,
  'withdrawal-k2'
);

select is(
  (select lifetime_cents from public.profile_earnings where profile_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  3000::bigint,
  '5: lifetime_cents still 3000 after withdrawal (withdrawals excluded from view)'
);                                                                                                          -- 5

-- ── 6: profile_earnings readable by anon ─────────────────────────────────────
set local role anon;
select ok(
  (select count(*) from public.profile_earnings) >= 0,
  '6: profile_earnings is SELECT-able by anon'
);                                                                                                          -- 6

-- ── 7: profile_earnings readable by authenticated ────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';
select ok(
  (select count(*) from public.profile_earnings) >= 0,
  '7: profile_earnings is SELECT-able by authenticated user'
);                                                                                                          -- 7

-- ── 8: lookup_notification_email admin-only guard (non-admin throws) ─────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';
select throws_ok(
  $$ select public.lookup_notification_email('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '42501', null,
  '8: non-admin cannot call lookup_notification_email'
);                                                                                                          -- 8

-- ── 9: lookup_notification_email works for admin ─────────────────────────────
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
select is(
  public.lookup_notification_email('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'submitter@example.com',
  '9: admin can lookup notification email for submitter'
);                                                                                                          -- 9

-- ── 10: anon cannot call lookup_notification_email ──────────────────────────
reset role;
set local role anon;
select throws_ok(
  $$ select public.lookup_notification_email('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '42501', null,
  '10: anon cannot call lookup_notification_email'
);                                                                                                          -- 10

select * from finish();
rollback;
