begin;
select plan(43);

-- ── seed 5 users (handle_new_user trigger creates a profile per auth.users insert) ──
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','alice@example.com','x', now(), now(), now()),  -- author (approved expert)
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','bob@example.com','x', now(), now(), now()),    -- submitter
  ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333','authenticated','authenticated','carol@example.com','x', now(), now(), now()),  -- admin
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','dave@example.com','x', now(), now(), now()),   -- unrelated
  ('00000000-0000-0000-0000-000000000000','55555555-5555-5555-5555-555555555555','authenticated','authenticated','eve@example.com','x', now(), now(), now());    -- REVOKED expert

update public.profiles set is_admin = true where id = '33333333-3333-3333-3333-333333333333';
insert into public.experts (id, status) values
  ('11111111-1111-1111-1111-111111111111','approved'),
  ('55555555-5555-5555-5555-555555555555','revoked');

-- seed ideas (as superuser; RLS not in force here). O/O2/H/D by alice; E by eve.
insert into public.ideas (id, author_id, type, title, status) values
  ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','open_ended','Open idea','open'),
  ('a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','open_ended','Open idea 2','open'),
  ('a0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','hypothesis','Hyp idea','open'),
  ('a0000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','open_ended','Draft idea','draft'),
  ('a0000000-0000-0000-0000-000000000005','55555555-5555-5555-5555-555555555555','open_ended','Eve idea','open');

set local role authenticated;

-- ========== bob (submitter) ==========
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into public.answers (id, idea_id, submitter_id, title)
  values ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Bob answer');
select ok((select count(*) from public.answers) = 1, '1: member submits answer to open idea');                                            -- 1
select throws_ok($$ insert into public.answers (idea_id, submitter_id, title, status)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','sneaky','verified') $$,
  '42501', null, '2: cannot insert pre-verified answer');                                                                                 -- 2
select throws_ok($$ insert into public.answers (idea_id, submitter_id, title)
  values ('a0000000-0000-0000-0000-000000000004','22222222-2222-2222-2222-222222222222','to draft') $$,
  '42501', null, '3: cannot submit answer to draft idea');                                                                                -- 3
select throws_ok($$ insert into public.answers (idea_id, submitter_id, title, legacy_id)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','squat', 5) $$,
  '42501', null, '4: cannot set legacy_id on a live insert (service-role only)');                                                          -- 4
insert into public.answer_artifacts (answer_id, url, kind)
  values ('b0000000-0000-0000-0000-000000000001','https://github.com/x/y','github');
select ok((select count(*) from public.answer_artifacts) = 1, '5: submitter adds artifact to editable answer');                          -- 5
select ok((select count(*) from public.answers where id='b0000000-0000-0000-0000-000000000001') = 1,
  '6: submitter reads own submitted answer');                                                                                            -- 6

-- ========== dave (unrelated) ==========
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select ok((select count(*) from public.answers) = 0, '7: unrelated user cannot read a non-verified answer');                             -- 7
select ok((select count(*) from public.answer_artifacts) = 0, '8: unrelated user cannot read artifacts of a non-verified answer');      -- 8
select throws_ok($$ insert into public.answer_artifacts (answer_id, url)
  values ('b0000000-0000-0000-0000-000000000001','https://evil') $$,
  '42501', null, '9: unrelated user cannot add an artifact');                                                                            -- 9
select throws_ok($$ select public.verify_answer('b0000000-0000-0000-0000-000000000001') $$,
  '42501', null, '10: unrelated user cannot verify (auth checked before payout)');                                                       -- 10

-- ========== alice (approved-expert author): no direct UPDATE; review transitions ==========
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
update public.answers set title = 'hacked' where id = 'b0000000-0000-0000-0000-000000000001';
select is((select title from public.answers where id='b0000000-0000-0000-0000-000000000001'),
  'Bob answer', '11: no direct client UPDATE on answers (0 rows, no policy)');                                                            -- 11
select lives_ok($$ select public.start_review('b0000000-0000-0000-0000-000000000001') $$, '12: author starts review');                  -- 12
select is((select status from public.answers where id='b0000000-0000-0000-0000-000000000001'),
  'under_review', '13: answer moved to under_review');                                                                                   -- 13
select lives_ok($$ select public.request_revision_answer('b0000000-0000-0000-0000-000000000001','add code') $$,
  '14: author requests revision');                                                                                                       -- 14
select is((select status from public.answers where id='b0000000-0000-0000-0000-000000000001'),
  'revision_requested', '15: answer moved to revision_requested');                                                                       -- 15

-- ========== bob resubmits ==========
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select lives_ok($$ select public.resubmit_answer('b0000000-0000-0000-0000-000000000001', null, 'now with code') $$,
  '16: submitter resubmits');                                                                                                            -- 16
select is((select status from public.answers where id='b0000000-0000-0000-0000-000000000001'),
  'submitted', '17: answer back to submitted');                                                                                          -- 17

-- ========== alice verifies (open-ended: idea stays open) ==========
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select throws_ok($$ select public.verify_answer('b0000000-0000-0000-0000-000000000001','x', null, null) $$,
  'P0001', null, '18: verify requires a positive intended payout');                                                                      -- 18
select lives_ok($$ select public.verify_answer('b0000000-0000-0000-0000-000000000001','great', 50000, null) $$,
  '19: author verifies with a recorded payout');                                                                                         -- 19
select is((select status from public.answers where id='b0000000-0000-0000-0000-000000000001'),
  'verified', '20: answer verified');                                                                                                     -- 20
select is((select payout_amount_cents from public.answers where id='b0000000-0000-0000-0000-000000000001'),
  50000::bigint, '21: intended payout recorded');                                                                                        -- 21
select ok((select count(*) from public.answer_reviews
  where answer_id='b0000000-0000-0000-0000-000000000001' and action='verify') = 1,
  '22: verify wrote an audit row');                                                                                                       -- 22
select is((select status from public.ideas where id='a0000000-0000-0000-0000-000000000001'),
  'open', '23: open-ended idea stays open on verify');                                                                                    -- 23

-- ========== anon: verified answer is public ==========
set local role anon;
select ok((select count(*) from public.answers where status='verified') = 1, '24: verified answer is public to anon');                  -- 24

-- ========== bob: audit table is deny-by-default for writes ==========
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select throws_ok($$ insert into public.answer_reviews (answer_id, actor_id, action)
  values ('b0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','verify') $$,
  '42501', null, '25: client cannot write the audit table');                                                                             -- 25

-- ========== hypothesis single-winner + auto-reject of losers ==========
insert into public.answers (id, idea_id, submitter_id, title) values
  ('b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','Hyp winner'),
  ('b0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','Hyp loser');
select ok((select count(*) from public.answers where idea_id='a0000000-0000-0000-0000-000000000003') = 2,
  '26: two answers submitted to the hypothesis idea');                                                                                   -- 26
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok($$ select public.verify_answer('b0000000-0000-0000-0000-000000000002','win', 10000, 'yes') $$,
  '27: author verifies the hypothesis winner');                                                                                          -- 27
select is((select status from public.ideas where id='a0000000-0000-0000-0000-000000000003'),
  'resolved', '28: hypothesis idea resolves on verify');                                                                                 -- 28
select is((select status from public.answers where id='b0000000-0000-0000-0000-000000000002'),
  'verified', '29: winner verified');                                                                                                     -- 29
select is((select status from public.answers where id='b0000000-0000-0000-0000-000000000003'),
  'rejected', '30: losing answer auto-rejected on resolution');                                                                          -- 30
select throws_ok($$ select public.verify_answer('b0000000-0000-0000-0000-000000000003','x', 1, 'yes') $$,
  'P0001', null, '31: cannot verify an answer that is no longer awaiting a decision');                                                    -- 31
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select throws_ok($$ insert into public.answers (id, idea_id, submitter_id, title)
  values ('b0000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','late') $$,
  '42501', null, '32: cannot submit a new answer to a resolved idea');                                                                    -- 32

-- ========== admin charitable-purpose gate ==========
select throws_ok($$ select public.admin_approve_payout('b0000000-0000-0000-0000-000000000001') $$,
  '42501', null, '33: non-admin cannot approve the payout gate');                                                                        -- 33
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select lives_ok($$ select public.admin_approve_payout('b0000000-0000-0000-0000-000000000001','charitable purpose ok') $$,
  '34: admin approves the payout gate');                                                                                                  -- 34
select ok((select admin_approved_by='33333333-3333-3333-3333-333333333333' and admin_approved_at is not null
  from public.answers where id='b0000000-0000-0000-0000-000000000001'), '35: admin approval recorded');                                  -- 35
select throws_ok($$ select public.admin_reject_payout('b0000000-0000-0000-0000-000000000001') $$,
  'P0001', null, '36: gate cannot be decided twice');                                                                                    -- 36
select lives_ok($$ select public.admin_reject_payout('b0000000-0000-0000-0000-000000000002','not this time') $$,
  '37: admin rejects another verified answer');                                                                                          -- 37
select ok((select admin_rejected_at is not null from public.answers where id='b0000000-0000-0000-0000-000000000002'),
  '38: admin rejection recorded');                                                                                                        -- 38

-- ========== author may reject a stalled revision_requested answer ==========
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into public.answers (id, idea_id, submitter_id, title)
  values ('b0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','O2 answer');
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok($$ select public.request_revision_answer('b0000000-0000-0000-0000-000000000004','revise') $$,
  '39: author requests revision on the O2 answer');                                                                                      -- 39
select lives_ok($$ select public.reject_answer('b0000000-0000-0000-0000-000000000004','closing out') $$,
  '40: author rejects a revision_requested answer');                                                                                     -- 40
select is((select status from public.answers where id='b0000000-0000-0000-0000-000000000004'),
  'rejected', '41: revision_requested answer can be rejected');                                                                          -- 41

-- ========== revoked expert cannot verify, even on their own idea ==========
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into public.answers (id, idea_id, submitter_id, title)
  values ('b0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000005','22222222-2222-2222-2222-222222222222','Answer to Eve idea');
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
select throws_ok($$ select public.verify_answer('b0000000-0000-0000-0000-000000000005','x', 5000, null) $$,
  '42501', null, '42: a revoked expert cannot verify (RPC re-checks experts.status, not just the UI)');                                  -- 42

-- ========== structural: answer_reviews is deny-by-default (only a SELECT policy) ==========
select is((select count(*)::int from pg_policies where schemaname='public' and tablename='answer_reviews'),
  1, '43: answer_reviews has exactly one (select-only) policy');                                                                          -- 43

select * from finish();
rollback;
