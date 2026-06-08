-- Open idea submission to everyone, but auto-archive non-experts' ideas for admin review.
-- Approved experts publish straight to 'open'; everyone else's submission is forced to 'archived'
-- (hidden from public listings + 404 on the detail page) until an admin promotes it.

-- 1) Anyone signed in may insert their OWN idea (was: approved experts only).
drop policy if exists "approved experts insert own ideas" on public.ideas;
create policy "authenticated insert own ideas" on public.ideas for insert to authenticated
  with check ((select auth.uid()) = author_id);

-- 2) Server-side status gate (BEFORE INSERT) so the rule can't be bypassed via the Data API.
--    INVOKER + pinned search_path; reads public.experts which is "readable by everyone".
create or replace function public.enforce_idea_submission()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.experts e
    where e.id = new.author_id and e.status = 'approved'
  ) then
    -- approved expert: keep an explicit draft, otherwise publish open
    if new.status is distinct from 'draft' then new.status := 'open'; end if;
  else
    -- everyone else: auto-archived pending admin promotion (overrides any client-supplied status)
    new.status := 'archived';
  end if;
  return new;
end;
$$;

create trigger ideas_enforce_submission
before insert on public.ideas
for each row execute function public.enforce_idea_submission();
