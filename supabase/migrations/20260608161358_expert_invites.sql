-- ============ expert_invites ============
-- Admin-managed invite links. Redemption is exclusively via the DEFINER RPC below;
-- no direct client INSERT/SELECT (only admin policy → non-admins can't touch rows).

create table public.expert_invites (
  id          uuid primary key default gen_random_uuid(),
  token       text unique not null,
  created_by  uuid not null references public.profiles(id),
  max_uses    int  not null default 1 check (max_uses >= 1),
  used_count  int  not null default 0 check (used_count >= 0),
  specialty   text,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.expert_invites enable row level security;

create policy "expert_invites admin all"
  on public.expert_invites for all to authenticated
  using  (public.is_admin())
  with check (public.is_admin());

-- ============ redeem_expert_invite ============
-- Authenticated non-admin calls this with a token; on success they become an approved expert.
-- Uses FOR UPDATE to serialize concurrent redemptions of a shared-use token.

create or replace function public.redeem_expert_invite(p_token text)
returns public.experts language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := auth.uid();
  v_invite public.expert_invites;
  v_expert public.experts;
begin
  if v_uid is null then
    raise exception 'auth required' using errcode = '42501';
  end if;

  -- lock the row to serialize concurrent redeems
  select * into v_invite
    from public.expert_invites
   where token = p_token
   for update;

  if not found then
    raise exception 'invalid invite' using errcode = 'P0002';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'invite expired' using errcode = 'P0001';
  end if;

  if v_invite.used_count >= v_invite.max_uses then
    raise exception 'invite already fully used' using errcode = 'P0001';
  end if;

  -- guard: don't consume a use if they're already approved
  if exists (select 1 from public.experts e where e.id = v_uid and e.status = 'approved') then
    raise exception 'already an approved expert' using errcode = 'P0001';
  end if;

  -- upsert the caller as an approved expert
  insert into public.experts (id, status, specialty, approved_by, approved_at)
    values (v_uid, 'approved', v_invite.specialty, v_invite.created_by, now())
    on conflict (id) do update
      set status      = 'approved',
          specialty   = coalesce(public.experts.specialty, excluded.specialty),
          approved_by = excluded.approved_by,
          approved_at = now()
    returning * into v_expert;

  -- increment use counter
  update public.expert_invites
     set used_count = used_count + 1
   where id = v_invite.id;

  return v_expert;
end;
$$;

revoke all on function public.redeem_expert_invite(text) from public, anon;
grant execute on function public.redeem_expert_invite(text) to authenticated;
