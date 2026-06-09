-- ============ rate_limits (fixed-window counters; NO service-role CLIENT) ============
-- Writes go ONLY through the SECURITY DEFINER function below (owned by postgres, bypasses RLS),
-- which self-keys on auth.uid() and looks up limits server-side. The table has ZERO client
-- policies, so a direct PostgREST UPDATE/DELETE/SELECT by `authenticated` matches nothing - the
-- three INVOKER bypass vectors (self-reset count, self-delete, caller-chosen window) are closed.
-- A definer function is a DB primitive, NOT the forbidden service-role client.
create table public.rate_limits (
  key          text not null,         -- 'user:<uuid>' (authed users only; anon login is in-memory app-side)
  bucket       text not null,
  window_start timestamptz not null,  -- aligned to the bucket's window size
  count        int  not null default 1,
  primary key (key, bucket, window_start)
);
alter table public.rate_limits enable row level security;
-- ZERO policies on purpose (deny-by-default for every client role, like answers/answer_reviews).

-- Limits are AUTHORITATIVE here (server-side), not caller params - nothing for a client to spoof.
create function public.consume_rate_limit(p_bucket text)
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
