-- ============ Phase 2 - Money RPCs ============
-- All writes are SECURITY DEFINER (owned by postgres), set search_path = '', fully-qualified.
-- They post to the ledger ONLY via public.post_ledger(jsonb, text), which enforces
-- balanced-sum-zero + >=2 legs + idempotency. Internal guards (is_admin, funding_enabled,
-- auth.uid) carry all authority - no service-role client anywhere.

-- ── 1. credit_balance: admin/test funding credit. NOT gated by funding_enabled. ──
-- Donation in: external -amount; funder +net; platform_treasury +fee (only if fee>0).
create or replace function public.credit_balance(
  p_profile uuid, p_amount_cents bigint, p_idempotency_key text, p_source text default 'credit')
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := auth.uid();
  v_fee_bps int;
  v_funding boolean;
  v_fee     bigint;
  v_net     bigint;
  v_entries jsonb;
begin
  if v_uid is null then raise exception 'auth required' using errcode = '42501'; end if;
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if p_amount_cents <= 0 then raise exception 'amount must be positive' using errcode = 'P0001'; end if;
  select fee_bps, funding_enabled into v_fee_bps, v_funding from public.platform_config where id = true;
  v_fee := floor(p_amount_cents * v_fee_bps / 10000);
  v_net := p_amount_cents - v_fee;
  v_entries := jsonb_build_array(
    jsonb_build_object('kind','donation','account','external','amount_cents', -p_amount_cents),
    jsonb_build_object('kind','donation','account','funder','profile_id', p_profile, 'amount_cents', v_net, 'note', p_source)
  );
  if v_fee > 0 then
    v_entries := v_entries || jsonb_build_array(
      jsonb_build_object('kind','fee','account','platform_treasury','amount_cents', v_fee));
  end if;
  perform public.post_ledger(v_entries, p_idempotency_key);
end; $$;
revoke all on function public.credit_balance(uuid, bigint, text, text) from public, anon;
grant execute on function public.credit_balance(uuid, bigint, text, text) to authenticated;

-- ── 2. escrow_pledge: a funder moves available → bounty escrow on an open idea. ──
create or replace function public.escrow_pledge(
  p_idea uuid, p_amount_cents bigint, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid        uuid := auth.uid();
  v_funding    boolean;
  v_idea       public.ideas;
  v_available  bigint;
  v_funding_id uuid;
  v_entries    jsonb;
begin
  if v_uid is null then raise exception 'auth required' using errcode = '42501'; end if;
  select funding_enabled into v_funding from public.platform_config where id = true;
  if not v_funding then raise exception 'funding is disabled' using errcode = 'P0001'; end if;
  -- idempotency short-circuit
  if p_idempotency_key is not null and exists (
       select 1 from public.ledger_entries where idempotency_key = p_idempotency_key) then
    return null;
  end if;
  if p_amount_cents <= 0 then raise exception 'amount must be positive' using errcode = 'P0001'; end if;
  select * into v_idea from public.ideas where id = p_idea for update;
  if not found then raise exception 'idea not found' using errcode = 'P0002'; end if;
  if v_idea.status <> 'open' then
    raise exception 'idea is not open (status=%)', v_idea.status using errcode = 'P0001'; end if;
  v_available := (select coalesce(sum(amount_cents),0) from public.ledger_entries
                  where profile_id = v_uid and account = 'funder');
  if v_available < p_amount_cents then
    raise exception 'insufficient available balance' using errcode = 'P0001'; end if;
  insert into public.idea_funding (idea_id, funder_id, amount_cents, status)
    values (p_idea, v_uid, p_amount_cents, 'escrowed') returning id into v_funding_id;
  v_entries := jsonb_build_array(
    jsonb_build_object('kind','escrow','account','funder','profile_id', v_uid, 'amount_cents', -p_amount_cents),
    jsonb_build_object('kind','escrow','account','bounty','profile_id', v_uid, 'idea_id', p_idea, 'amount_cents', p_amount_cents)
  );
  perform public.post_ledger(v_entries, p_idempotency_key);
  return v_funding_id;
end; $$;
revoke all on function public.escrow_pledge(uuid, bigint, text) from public, anon;
grant execute on function public.escrow_pledge(uuid, bigint, text) to authenticated;

-- ── 3. release_grant: admin pays an approved answer's payout out of the idea's escrow. ──
-- FIFO draw across the idea's funders (oldest funder first), crediting submitter's payable.
create or replace function public.release_grant(p_answer uuid, p_idempotency_key text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid        uuid := auth.uid();
  v_funding    boolean;
  v_answer     public.answers;
  v_payout     bigint;
  v_submitter  uuid;
  v_idea       uuid;
  v_total_esc  bigint;
  v_remaining  bigint;
  v_fesc       bigint;
  v_draw       bigint;
  v_f          record;
  v_entries    jsonb;
begin
  if v_uid is null then raise exception 'auth required' using errcode = '42501'; end if;
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  select funding_enabled into v_funding from public.platform_config where id = true;
  if not v_funding then raise exception 'funding is disabled' using errcode = 'P0001'; end if;
  -- idempotency short-circuit
  if p_idempotency_key is not null and exists (
       select 1 from public.ledger_entries where idempotency_key = p_idempotency_key) then
    return;
  end if;
  select * into v_answer from public.answers where id = p_answer for update;
  if not found then raise exception 'answer not found' using errcode = 'P0002'; end if;
  if v_answer.admin_approved_at is null then
    raise exception 'payout not admin-approved' using errcode = 'P0001'; end if;
  v_payout := v_answer.payout_amount_cents;
  if v_payout is null or v_payout <= 0 then
    raise exception 'no recorded payout amount' using errcode = 'P0001'; end if;
  v_submitter := v_answer.submitter_id;
  v_idea := v_answer.idea_id;

  v_total_esc := (select coalesce(sum(amount_cents),0) from public.ledger_entries
                  where idea_id = v_idea and account = 'bounty');
  if v_total_esc < v_payout then
    raise exception 'insufficient escrow to release' using errcode = 'P0001'; end if;

  -- FIFO draw across funders: oldest funder first
  v_remaining := v_payout;
  v_entries := '[]'::jsonb;
  for v_f in (select funder_id from public.idea_funding
              where idea_id = v_idea and status = 'escrowed'
              group by funder_id order by min(created_at) asc) loop
    exit when v_remaining <= 0;
    v_fesc := (select coalesce(sum(amount_cents),0) from public.ledger_entries
               where idea_id = v_idea and account = 'bounty' and profile_id = v_f.funder_id);
    v_draw := least(v_fesc, v_remaining);
    if v_draw > 0 then
      v_entries := v_entries || jsonb_build_array(
        jsonb_build_object('kind','release','account','bounty','profile_id', v_f.funder_id,
                           'idea_id', v_idea, 'amount_cents', -v_draw));
      v_remaining := v_remaining - v_draw;
    end if;
  end loop;

  -- credit the submitter's payable
  v_entries := v_entries || jsonb_build_array(
    jsonb_build_object('kind','release','account','payable','profile_id', v_submitter,
                       'answer_id', p_answer, 'amount_cents', v_payout));
  perform public.post_ledger(v_entries, p_idempotency_key);

  -- flip fully-drained funding rows to 'released' (any funder whose escrow-on-idea is now 0)
  update public.idea_funding f set status = 'released'
   where f.idea_id = v_idea and f.status = 'escrowed'
     and (select coalesce(sum(le.amount_cents),0) from public.ledger_entries le
          where le.idea_id = v_idea and le.account = 'bounty' and le.profile_id = f.funder_id) = 0;
end; $$;
revoke all on function public.release_grant(uuid, text) from public, anon;
grant execute on function public.release_grant(uuid, text) to authenticated;

-- ── 4. refund_funder: admin returns a funder's remaining escrow on an idea to available. ──
-- Refund is per-funder-per-idea (not partial-per-row): the funder's full current escrow on
-- the idea is returned, and ALL their escrowed rows on the idea flip to 'refunded'.
create or replace function public.refund_funder(p_funding_id uuid, p_idempotency_key text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid      uuid := auth.uid();
  v_row      public.idea_funding;
  v_funder   uuid;
  v_idea     uuid;
  v_refund   bigint;
  v_entries  jsonb;
begin
  if v_uid is null then raise exception 'auth required' using errcode = '42501'; end if;
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  -- idempotency short-circuit
  if p_idempotency_key is not null and exists (
       select 1 from public.ledger_entries where idempotency_key = p_idempotency_key) then
    return;
  end if;
  select * into v_row from public.idea_funding where id = p_funding_id for update;
  if not found then raise exception 'funding row not found' using errcode = 'P0002'; end if;
  if v_row.status <> 'escrowed' then
    raise exception 'funding is not escrowed (status=%)', v_row.status using errcode = 'P0001'; end if;
  v_funder := v_row.funder_id;
  v_idea := v_row.idea_id;
  v_refund := (select coalesce(sum(amount_cents),0) from public.ledger_entries
               where idea_id = v_idea and account = 'bounty' and profile_id = v_funder);
  if v_refund <= 0 then
    raise exception 'no remaining escrow to refund' using errcode = 'P0001'; end if;
  v_entries := jsonb_build_array(
    jsonb_build_object('kind','refund','account','bounty','profile_id', v_funder,
                       'idea_id', v_idea, 'amount_cents', -v_refund),
    jsonb_build_object('kind','refund','account','funder','profile_id', v_funder, 'amount_cents', v_refund)
  );
  perform public.post_ledger(v_entries, p_idempotency_key);
  update public.idea_funding set status = 'refunded'
   where idea_id = v_idea and funder_id = v_funder and status = 'escrowed';
end; $$;
revoke all on function public.refund_funder(uuid, text) from public, anon;
grant execute on function public.refund_funder(uuid, text) to authenticated;

-- ── 5. admin_credit_offplatform: admin records a manual/off-platform credit. ──
-- Nested DEFINER call keeps auth.uid()=admin, so credit_balance's admin check passes.
create or replace function public.admin_credit_offplatform(
  p_profile uuid, p_amount_cents bigint, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_key text;
begin
  if v_uid is null then raise exception 'auth required' using errcode = '42501'; end if;
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  v_key := 'offplatform:' || gen_random_uuid()::text;
  perform public.credit_balance(p_profile, p_amount_cents, v_key, 'offplatform:' || coalesce(p_note, ''));
end; $$;
revoke all on function public.admin_credit_offplatform(uuid, bigint, text) from public, anon;
grant execute on function public.admin_credit_offplatform(uuid, bigint, text) to authenticated;

-- ── Extend admin_approve_payout: on approval, fire release_grant when funding is on. ──
-- Body copied verbatim from 20260605134020_answer_rpcs.sql:153-172, with the funding-aware
-- release appended before the return. The deterministic release key keeps it idempotent.
create or replace function public.admin_approve_payout(p_answer_id uuid, p_note text default null)
returns public.answers language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_answer public.answers; v_funding boolean;
begin
  if v_uid is null then raise exception 'auth required' using errcode = '42501'; end if;
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  select * into v_answer from public.answers where id = p_answer_id for update;
  if not found then raise exception 'answer not found' using errcode = 'P0002'; end if;
  if v_answer.status <> 'verified' then
    raise exception 'answer is not verified (status=%)', v_answer.status using errcode = 'P0001'; end if;
  if v_answer.admin_approved_at is not null or v_answer.admin_rejected_at is not null then
    raise exception 'gate already decided' using errcode = 'P0001'; end if;
  if v_answer.payout_amount_cents is null or v_answer.payout_amount_cents <= 0 then
    raise exception 'cannot approve a payout with no recorded amount' using errcode = 'P0001'; end if;
  update public.answers set admin_approved_by = v_uid, admin_approved_at = now()
    where id = p_answer_id returning * into v_answer;
  insert into public.answer_reviews (answer_id, actor_id, action, note_md, amount_cents)
    values (p_answer_id, v_uid, 'admin_approve', p_note, v_answer.payout_amount_cents);
  select funding_enabled into v_funding from public.platform_config where id = true;
  if v_funding then
    perform public.release_grant(p_answer_id, 'release:' || p_answer_id::text);
  end if;
  return v_answer;
end; $$;
revoke all on function public.admin_approve_payout(uuid, text) from public, anon;
grant execute on function public.admin_approve_payout(uuid, text) to authenticated;
