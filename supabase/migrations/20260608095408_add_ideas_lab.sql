-- ============ Ideas Lab: expansions, supporter, gating extensions, AI access, rate bucket ============

-- 1) ideas.expansions: per-draft tool output, keyed by tool
alter table public.ideas add column expansions jsonb not null default '{}'::jsonb;

-- 2) profiles.supporter_until: active monthly supporter when > now() (admin/billing set)
alter table public.profiles add column supporter_until timestamptz;

-- 3) INSERT gate: exempt drafts (private scratchpad); else expert→open, other→archived.
--    create or replace — replaces the version from 20260608081014_open_idea_submissions.sql
create or replace function public.enforce_idea_submission()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'draft' then
    return new; -- a draft stays a private draft
  end if;
  if exists (select 1 from public.experts e where e.id = new.author_id and e.status = 'approved') then
    new.status := 'open';
  else
    new.status := 'archived';
  end if;
  return new;
end;
$$;

-- 4) UPDATE (publish) gate: when status moves from a non-public to a public state, re-apply
--    the expert check so a non-expert can't self-publish by editing a draft to 'open'.
create or replace function public.enforce_idea_publish()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status in ('open','resolved','closed') and old.status not in ('open','resolved','closed') then
    if not exists (select 1 from public.experts e where e.id = new.author_id and e.status = 'approved')
       and not public.is_admin() then
      new.status := 'archived'; -- submitted for admin review
    end if;
  end if;
  return new;
end;
$$;
create trigger ideas_enforce_publish
before update on public.ideas
for each row when (old.status is distinct from new.status)
execute function public.enforce_idea_publish();

-- 5) AI access predicate: admin OR approved expert OR active monthly supporter
create or replace function public.can_use_lab_ai()
returns boolean language sql security definer set search_path = '' stable as $$
  select public.is_admin()
      or exists (select 1 from public.experts e where e.id = auth.uid() and e.status = 'approved')
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.supporter_until > now());
$$;
revoke all on function public.can_use_lab_ai() from public;
grant execute on function public.can_use_lab_ai() to authenticated;

-- 6) Add ai_generate bucket to consume_rate_limit (copy function verbatim + new CASE arm).
--    Source: supabase/migrations/20260607102806_rate_limits.sql — only the CASE arm is new.
create or replace function public.consume_rate_limit(p_bucket text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_max int;
  v_window_secs int;
  v_window timestamptz;
  v_count int;
begin
  if v_uid is null then
    return true;   -- anon callers are not tracked here (login uses the app's in-memory limiter)
  end if;

  -- authoritative limit table; keep in sync with BUCKETS in $lib/server/rate-limit.ts
  case p_bucket
    when 'comment'        then v_max := 10;  v_window_secs := 300;
    when 'comment_delete' then v_max := 30;  v_window_secs := 300;
    when 'engage'         then v_max := 60;  v_window_secs := 300;
    when 'pledge'         then v_max := 10;  v_window_secs := 300;
    when 'answer'         then v_max := 5;   v_window_secs := 3600;
    when 'idea_create'    then v_max := 10;  v_window_secs := 3600;
    when 'review'         then v_max := 60;  v_window_secs := 300;
    when 'profile'        then v_max := 10;  v_window_secs := 3600;
    when 'admin'          then v_max := 120; v_window_secs := 300;
    when 'ai_generate'    then v_max := 30;  v_window_secs := 3600;
    else raise exception 'unknown rate-limit bucket: %', p_bucket;  -- dev bug → fail-open + logged
  end case;

  v_window := to_timestamp(floor(extract(epoch from now()) / v_window_secs) * v_window_secs);

  -- prune this caller's stale rows for this bucket (definer-owned; no client DELETE path exists)
  delete from public.rate_limits
    where key = 'user:' || v_uid::text and bucket = p_bucket
      and window_start < now() - make_interval(secs => 2 * v_window_secs);

  insert into public.rate_limits as r (key, bucket, window_start)
    values ('user:' || v_uid::text, p_bucket, v_window)
    on conflict (key, bucket, window_start)
    do update set count = r.count + 1
    returning count into v_count;

  return v_count <= v_max;
end $$;

revoke execute on function public.consume_rate_limit(text) from public, anon;
grant execute on function public.consume_rate_limit(text) to authenticated;
