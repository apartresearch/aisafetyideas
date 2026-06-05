-- handle_new_user is a trigger-only function; it must not be callable as a REST RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
