begin;
select plan(8);

-- Seed both users upfront (as postgres, before any role changes)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-000000000001','authenticated','authenticated','tpl_alice@example.com','x', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-000000000002','authenticated','authenticated','tpl_bob@example.com','x', now(), now(), now());
insert into public.experts (id, status) values ('aaaaaaaa-0000-0000-0000-000000000001','approved');

-- 1-4) The four template columns exist with expected types
select has_column('public','ideas','resolution_criteria_md','resolution_criteria_md column exists');
select has_column('public','ideas','methodology_md','methodology_md column exists');
select has_column('public','ideas','theory_of_change_md','theory_of_change_md column exists');
select has_column('public','ideas','extensions_md','extensions_md column exists');

-- act as alice (approved expert)
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

-- 5) Author can insert an idea WITH all four template columns set and they round-trip
insert into public.ideas (
  id, author_id, type, title, status,
  resolution_criteria_md, methodology_md, theory_of_change_md, extensions_md
) values (
  'cccccccc-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'open_ended', 'Template test idea', 'open',
  '## Resolution criteria', '## Methodology', '## Theory of change', '## Extensions'
);

select is(
  (select resolution_criteria_md from public.ideas where id = 'cccccccc-0000-0000-0000-000000000001'),
  '## Resolution criteria',
  'resolution_criteria_md round-trips');

-- 6) An insert WITHOUT the template columns still works (nullable — existing behaviour unaffected)
insert into public.ideas (
  id, author_id, type, title, status
) values (
  'cccccccc-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'open_ended', 'Minimal idea', 'open'
);

select ok(
  (select resolution_criteria_md from public.ideas where id = 'cccccccc-0000-0000-0000-000000000002') is null,
  'insert without template columns leaves them null');

-- 7) Draft an idea as alice, then confirm bob cannot see it (RLS intact)
update public.ideas set status = 'draft' where id = 'cccccccc-0000-0000-0000-000000000001';

set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}';
select ok(
  not exists(select 1 from public.ideas where id = 'cccccccc-0000-0000-0000-000000000001' and status = 'draft'),
  'non-author cannot see another user''s draft (RLS still intact)');

-- 8) Alice can still see her own draft
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
select ok(
  exists(select 1 from public.ideas where id = 'cccccccc-0000-0000-0000-000000000001' and status = 'draft'),
  'author sees own draft');

select * from finish();
rollback;
