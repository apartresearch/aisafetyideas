begin;
select plan(11);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','alice@example.com','x', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','bob@example.com','x', now(), now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- ===== limit math on 'answer' (max 5 / hour); 4 warm-up calls, then assert at/over limit =====
select public.consume_rate_limit('answer');
select public.consume_rate_limit('answer');
select public.consume_rate_limit('answer');
select public.consume_rate_limit('answer');
select ok(public.consume_rate_limit('answer'), '1: 5th call AT limit still true');
select ok(not public.consume_rate_limit('answer'), '2: 6th call over limit → false');

-- ===== limits are server-authoritative: an unknown bucket raises (a dev bug, not a runtime path) =====
select throws_ok($$ select public.consume_rate_limit('nope') $$, 'P0001', null, '3: unknown bucket raises');

-- ===== zero-policy lockdown: a client cannot read or mutate rate_limits directly =====
select ok((select count(*) from public.rate_limits) = 0,
  '4: authenticated cannot SELECT rate_limits (zero policies) though rows exist via the definer fn');
with u as (update public.rate_limits set count = 0 where bucket = 'answer' returning 1)
  select ok((select count(*) from u) = 0, '5: direct UPDATE count=0 matches no rows (Vector 1 closed)');
with d as (delete from public.rate_limits where bucket = 'answer' returning 1)
  select ok((select count(*) from d) = 0, '6: direct DELETE matches no rows (Vector 2 closed)');
select ok(not public.consume_rate_limit('answer'),
  '7: still over limit - the direct UPDATE/DELETE attempts reset nothing');

-- ===== cross-user isolation: bob starts fresh in the same bucket =====
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select ok(public.consume_rate_limit('answer'), '8: another user starts fresh');

-- ===== window rollover: now() is FROZEN inside a txn, so age the stored row as the owner =====
reset role;
update public.rate_limits set window_start = window_start - interval '3 hours'
  where key = 'user:11111111-1111-1111-1111-111111111111' and bucket = 'answer';
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select ok(public.consume_rate_limit('answer'), '9: a new window resets the limit (aged row is stale)');
reset role;
select ok((select count(*) from public.rate_limits
           where key = 'user:11111111-1111-1111-1111-111111111111' and bucket = 'answer') = 1,
  '10: the stale aged row was pruned - only the live window row remains');

-- ===== anon cannot execute the function (revoked) =====
set local role anon;
set local request.jwt.claims = '';
select throws_ok($$ select public.consume_rate_limit('comment') $$, '42501', null,
  '11: anon execute is denied');

select * from finish();
rollback;
