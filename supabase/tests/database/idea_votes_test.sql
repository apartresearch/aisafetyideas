begin;
select plan(15);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','alice@example.com','x', now(), now(), now()),  -- expert author
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','bob@example.com','x', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','dave@example.com','x', now(), now(), now());

insert into public.experts (id, status) values ('11111111-1111-1111-1111-111111111111','approved');
insert into public.ideas (id, author_id, type, title, status) values
  ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','open_ended','Open idea','open'),
  ('a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','open_ended','Draft idea','draft');

set local role authenticated;

-- ===== bob votes (insert pinning) =====
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into public.idea_votes (idea_id, profile_id, value)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',1);
select ok((select count(*) from public.idea_votes) = 1, '1: member upvotes a visible idea');
select throws_ok($$ insert into public.idea_votes (idea_id, profile_id, value)
  values ('a0000000-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444',1) $$,
  '42501', null, '2: cannot vote as another member');
select throws_ok($$ insert into public.idea_votes (idea_id, profile_id, value)
  values ('a0000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222',1) $$,
  '42501', null, '3: cannot vote on a draft idea you cannot see');
select throws_ok($$ insert into public.idea_votes (idea_id, profile_id, value, legacy_id)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',1,7) $$,
  '42501', null, '4: cannot set legacy_id on a live vote');
select throws_ok($$ insert into public.idea_votes (idea_id, profile_id, value, legacy)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',1,'{"a":1}'::jsonb) $$,
  '42501', null, '5: cannot set a non-empty legacy on a live vote');
select throws_ok($$ insert into public.idea_votes (idea_id, profile_id, value)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',0) $$,
  '23514', null, '6: value must be -1 or 1');
select throws_ok($$ insert into public.idea_votes (idea_id, profile_id, value)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',-1) $$,
  '23505', null, '7: one vote per member per idea (switch = delete + re-insert)');

-- ===== dave downvotes; deletes are own-only =====
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
insert into public.idea_votes (idea_id, profile_id, value)
  values ('a0000000-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444',-1);
select ok((select count(*) from public.idea_votes) = 2, '8: second member downvotes');
update public.idea_votes set value = 1 where profile_id = '44444444-4444-4444-4444-444444444444';
select ok((select value from public.idea_votes where profile_id = '44444444-4444-4444-4444-444444444444') = -1,
  '8b: no UPDATE policy — a client update is a silent no-op (toggle is delete + re-insert)');
delete from public.idea_votes where profile_id = '22222222-2222-2222-2222-222222222222';
select ok((select count(*) from public.idea_votes) = 2, '9: deleting another member''s vote is a no-op');
select results_eq(
  $$ select score, up_count, down_count from public.idea_vote_totals where idea_id = 'a0000000-0000-0000-0000-000000000001' $$,
  $$ values (0::bigint, 1::bigint, 1::bigint) $$,
  '10: totals view aggregates score/up/down');
delete from public.idea_votes where profile_id = '44444444-4444-4444-4444-444444444444';
select ok((select count(*) from public.idea_votes where profile_id = '44444444-4444-4444-4444-444444444444') = 0,
  '11: member removes own vote');

-- ===== draft visibility (author can vote own draft; others see nothing) =====
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
insert into public.idea_votes (idea_id, profile_id, value)
  values ('a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',1);
select ok((select count(*) from public.idea_votes where idea_id = 'a0000000-0000-0000-0000-000000000002') = 1,
  '12: draft author can vote their own draft');

set local role anon;
-- CRITICAL: clear the stale JWT claims — `set local role` does NOT reset request.jwt.claims, so
-- auth.uid() would still be alice and the own-row SELECT branch would leak her draft vote into
-- test 14. The POLICY is correct; only an uncleared fixture would make it look broken. Do NOT
-- "fix" a red test 14 by weakening the policy or the view.
set local request.jwt.claims = '';
select ok((select count(*) from public.idea_votes where idea_id = 'a0000000-0000-0000-0000-000000000001') = 1,
  '13: anon sees votes on visible ideas');
select ok((select count(*) from public.idea_vote_totals where idea_id = 'a0000000-0000-0000-0000-000000000002') = 0,
  '14: draft votes invisible to anon through the view (security_invoker)');

select * from finish();
rollback;
