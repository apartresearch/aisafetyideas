-- ============ idea_funding (pledges; Phase 1 = visible commitments, money OFF) ============
create table public.idea_funding (
  id           uuid primary key default gen_random_uuid(),
  legacy_id    bigint unique,
  idea_id      uuid not null references public.ideas(id) on delete cascade,
  funder_id    uuid references public.profiles(id) on delete set null,
  amount_cents bigint not null check (amount_cents > 0),
  currency     text not null default 'USD',
  status       text not null default 'committed'
                 check (status in ('committed','escrowed','released','refunded')),
  note_md      text,
  legacy       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
alter table public.idea_funding enable row level security;
create index idea_funding_idea_id_idx on public.idea_funding (idea_id);
create index idea_funding_funder_id_idx on public.idea_funding (funder_id);

-- SELECT: a pledge is readable when the caller can see its idea (the ideas RLS hides drafts), OR the caller
-- is the funder. So un-publishing an idea (revert to draft) hides its pledges + pot too - no money-leak.
create policy "idea_funding readable when its idea is visible" on public.idea_funding for select
  using (
    (select auth.uid()) = funder_id
    or exists (select 1 from public.ideas i where i.id = idea_id)
  );

-- INSERT: a member pledges their OWN funding to an OPEN idea (Phase 1 = a visible pledge, no money moves);
-- status/currency/legacy pinned so a client cannot fabricate escrow/release/refund or squat a legacy_id;
-- amount capped ($1M) so a public pot can't be defaced with an absurd figure.
create policy "members pledge to open ideas" on public.idea_funding for insert to authenticated
  with check (
    (select auth.uid()) = funder_id
    and status = 'committed'
    and currency = 'USD'
    and amount_cents > 0
    and amount_cents <= 100000000
    and legacy_id is null and legacy = '{}'::jsonb
    and exists (select 1 from public.ideas i where i.id = idea_id and i.status = 'open')
  );

-- DELETE: a funder withdraws their own still-committed pledge
create policy "funder withdraws own committed pledge" on public.idea_funding for delete to authenticated
  using ((select auth.uid()) = funder_id and status = 'committed');

-- NOTE: NO update policy - committed -> escrowed -> released/refunded are Phase-2 SECURITY DEFINER money RPCs.

-- ============ bounty_pot (sum of active pledges per idea; no mutable column on ideas) ============
-- security_invoker so the view respects idea_funding RLS (which is public-select anyway).
create view public.bounty_pot with (security_invoker = true) as
  select idea_id,
         coalesce(sum(amount_cents) filter (where status in ('committed','escrowed')), 0)::bigint as pot_cents,
         count(distinct coalesce(funder_id::text, 'anon'))
           filter (where status in ('committed','escrowed')) as funder_count
  from public.idea_funding
  group by idea_id;

grant select on public.bounty_pot to anon, authenticated;
