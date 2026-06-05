-- Lock search_path on the trigger function (advisor: function_search_path_mutable).
-- now() resolves from pg_catalog regardless, so '' is safe.
create or replace function public.touch_updated_at() returns trigger
  language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
