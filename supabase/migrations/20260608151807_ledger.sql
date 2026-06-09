-- ============ ledger_entries: append-only double-entry ledger ============
-- Clients NEVER write to this table. The SECURITY DEFINER post_ledger() function
-- (owned by postgres, not granted to any client role) is the sole writer.
-- RLS: authenticated can SELECT their own rows. Zero write policies → deny by default.

create table public.ledger_entries (
  id               uuid        primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  kind             text        not null
                               check (kind in ('donation','fee','escrow','release','refund','withdrawal','offplatform_credit','adjustment')),
  account          text        not null
                               check (account in ('funder','bounty','platform_treasury','payable','external')),
  profile_id       uuid        references public.profiles(id),
  idea_id          uuid        references public.ideas(id),
  answer_id        uuid        references public.answers(id),
  amount_cents     bigint      not null,
  currency         text        not null default 'USD',
  idempotency_key  text        unique,           -- Postgres UNIQUE allows multiple NULLs; only set on the first leg
  stripe_event_id  text,                         -- unused until Phase 3; column added now to avoid ALTER
  note             text,
  created_by       uuid        references public.profiles(id)
);

create index ledger_entries_profile_id_idx on public.ledger_entries (profile_id);
create index ledger_entries_idea_id_idx    on public.ledger_entries (idea_id);

alter table public.ledger_entries enable row level security;

-- SELECT only for authenticated: own rows or admin.
-- NO insert/update/delete policy → deny-by-default for all clients.
create policy "ledger_entries: read own or admin"
  on public.ledger_entries for select
  to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());

-- ============ account_balances view ============
-- security_invoker = true → view runs under the calling role, so RLS on
-- ledger_entries is respected; a user only sees their own balance.
create view public.account_balances with (security_invoker = true) as
select profile_id,
  coalesce(sum(amount_cents) filter (where account = 'funder'),  0)::bigint as available_cents,
  coalesce(sum(amount_cents) filter (where account = 'bounty'),  0)::bigint as escrowed_cents,
  coalesce(sum(amount_cents) filter (where account = 'payable'), 0)::bigint as payable_cents
from public.ledger_entries
where profile_id is not null
group by profile_id;

-- ============ post_ledger: SECURITY DEFINER poster (owned by postgres) ============
-- This function is NOT callable by clients (all grants revoked).
-- Phase 2 RPCs (also DEFINER, owned by postgres) call it internally.
--
-- p_entries: JSON array of objects:
--   { kind, account, profile_id?, idea_id?, answer_id?, amount_cents, note? }
-- p_idempotency_key: if set and already present in the table, the call is a no-op.
-- Invariants enforced:
--   1. sum(amount_cents) = 0 (balanced double-entry)
--   2. array length >= 2
create or replace function public.post_ledger(
  p_entries         jsonb,
  p_idempotency_key text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sum        bigint := 0;
  v_count      int    := 0;
  v_entry      jsonb;
  v_is_first   boolean := true;
  v_idem_key   text;
begin
  -- Idempotency guard
  if p_idempotency_key is not null then
    if exists (
      select 1 from public.ledger_entries
      where idempotency_key = p_idempotency_key
    ) then
      return;   -- already posted; safe to call again
    end if;
  end if;

  -- Validate: at least 2 legs
  v_count := jsonb_array_length(p_entries);
  if v_count < 2 then
    raise exception 'ledger transaction needs >= 2 legs' using errcode = 'P0001';
  end if;

  -- Validate: balanced (sum = 0)
  select sum((e->>'amount_cents')::bigint)
    into v_sum
  from jsonb_array_elements(p_entries) as e;

  if v_sum <> 0 then
    raise exception 'ledger transaction not balanced: %', v_sum using errcode = 'P0001';
  end if;

  -- Insert legs
  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    -- idempotency_key only on the first leg; null on subsequent legs
    if v_is_first then
      v_idem_key := p_idempotency_key;
      v_is_first := false;
    else
      v_idem_key := null;
    end if;

    insert into public.ledger_entries
      (kind, account, profile_id, idea_id, answer_id, amount_cents, currency, note, idempotency_key, created_by)
    values (
      v_entry->>'kind',
      v_entry->>'account',
      (v_entry->>'profile_id')::uuid,
      (v_entry->>'idea_id')::uuid,
      (v_entry->>'answer_id')::uuid,
      (v_entry->>'amount_cents')::bigint,
      coalesce(v_entry->>'currency', 'USD'),
      v_entry->>'note',
      v_idem_key,
      (select auth.uid())
    );
  end loop;
end;
$$;

-- post_ledger is an INTERNAL helper - not callable by clients or anon.
-- Phase 2 DEFINER RPCs (owned by postgres) call it directly; no grant needed.
revoke all on function public.post_ledger(jsonb, text) from public, anon, authenticated;