-- ============ draft → review → live workflow ============
-- Non-experts submitting an idea land in a `review` queue (was `archived`); approved experts
-- still go straight to `open`. Admins moderate the queue via an admin-only DEFINER RPC.

-- 1) Add `review` to the ideas status constraint (inline check from 20260605121910_ideas.sql).
alter table public.ideas drop constraint if exists ideas_status_check;
alter table public.ideas add constraint ideas_status_check
  check (status in ('draft','review','open','resolved','closed','archived'));

-- 2) INSERT gate: a draft stays a draft; approved expert → open; everyone else → review.
--    create or replace - replaces the version from 20260608095408_add_ideas_lab.sql
create or replace function public.enforce_idea_submission()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'draft' then return new; end if;        -- private draft stays a draft
  if exists (select 1 from public.experts e where e.id = new.author_id and e.status = 'approved') then
    new.status := 'open';                                  -- approved expert: straight to live
  else
    new.status := 'review';                                -- everyone else: into the review queue
  end if;
  return new;
end; $$;

-- 3) UPDATE (publish) gate: a non-expert, non-admin moving an idea to a public state is
--    routed to `review` instead (was `archived`).
--    create or replace - replaces the version from 20260608095408_add_ideas_lab.sql
create or replace function public.enforce_idea_publish()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status in ('open','resolved','closed') and old.status not in ('open','resolved','closed') then
    if not exists (select 1 from public.experts e where e.id = new.author_id and e.status = 'approved')
       and not public.is_admin() then
      new.status := 'review';   -- submitted for admin review (was 'archived')
    end if;
  end if;
  return new;
end; $$;

-- 4) admin_moderate_idea: admin-only moderation of a `review` idea.
--    approve → open, request_changes → draft, reject → archived. The admin UPDATE passes the
--    publish trigger because is_admin() is true.
create or replace function public.admin_moderate_idea(p_idea uuid, p_action text)
returns public.ideas language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := auth.uid();
  v_idea   public.ideas;
  v_status text;
begin
  if v_uid is null then raise exception 'auth required' using errcode = '42501'; end if;
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  v_status := case p_action
    when 'approve'         then 'open'
    when 'request_changes' then 'draft'
    when 'reject'          then 'archived'
    else null
  end;
  if v_status is null then
    raise exception 'unknown moderation action: %', p_action using errcode = 'P0001'; end if;
  select * into v_idea from public.ideas where id = p_idea for update;
  if not found then raise exception 'idea not found' using errcode = 'P0002'; end if;
  if v_idea.status <> 'review' then
    raise exception 'idea is not in review (status=%)', v_idea.status using errcode = 'P0001'; end if;
  update public.ideas
     set status = v_status,
         published_at = case when v_status = 'open' then now() else published_at end
   where id = p_idea
   returning * into v_idea;
  return v_idea;
end; $$;
revoke all on function public.admin_moderate_idea(uuid, text) from public, anon;
grant execute on function public.admin_moderate_idea(uuid, text) to authenticated;
