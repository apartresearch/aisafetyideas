-- ── helper: an authenticated user may act as an idea's author ONLY if they are still an approved expert,
--    or they are an admin. This is the RPC-level authority (the console UI gate is defense-in-depth only). ──
-- (Implemented inline in each author-facing RPC as:
--    (v_idea.author_id = v_uid and exists (select 1 from public.experts e
--                                           where e.id = v_uid and e.status = 'approved'))
--    or public.is_admin()  )

-- start_review: approved-expert author / admin marks a submitted answer (on an open idea) as under_review
create or replace function public.start_review(p_answer_id uuid)
returns public.answers language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_answer public.answers; v_idea public.ideas;
begin
  if v_uid is null then raise exception 'auth required' using errcode = '42501'; end if;
  select * into v_answer from public.answers where id = p_answer_id for update;
  if not found then raise exception 'answer not found' using errcode = 'P0002'; end if;
  select * into v_idea from public.ideas where id = v_answer.idea_id for update;
  if not ((v_idea.author_id = v_uid and exists (select 1 from public.experts e
              where e.id = v_uid and e.status = 'approved')) or public.is_admin()) then
    raise exception 'only an approved expert author or an admin can review' using errcode = '42501'; end if;
  if v_idea.status <> 'open' then
    raise exception 'idea is not open (status=%)', v_idea.status using errcode = 'P0001'; end if;
  if v_answer.status <> 'submitted' then
    raise exception 'answer is not in submitted state (status=%)', v_answer.status using errcode = 'P0001'; end if;
  update public.answers set status = 'under_review' where id = p_answer_id returning * into v_answer;
  insert into public.answer_reviews (answer_id, actor_id, action) values (p_answer_id, v_uid, 'start_review');
  return v_answer;
end; $$;
revoke all on function public.start_review(uuid) from public, anon;
grant execute on function public.start_review(uuid) to authenticated;

-- verify_answer: approved-expert author / admin verifies. Requires a positive intended payout (money OFF: recorded,
--   not moved) and, for hypotheses, a resolution. Locks the idea so concurrent verifies serialize (single winner).
--   On hypothesis resolution, auto-rejects every other undecided answer on the idea (no stuck states).
create or replace function public.verify_answer(
  p_answer_id uuid, p_note text default null,
  p_payout_amount_cents bigint default null, p_resolution text default null)
returns public.answers language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_answer public.answers; v_idea public.ideas;
begin
  if v_uid is null then raise exception 'auth required' using errcode = '42501'; end if;
  select * into v_answer from public.answers where id = p_answer_id for update;
  if not found then raise exception 'answer not found' using errcode = 'P0002'; end if;
  select * into v_idea from public.ideas where id = v_answer.idea_id for update;   -- serialize single-winner
  if not ((v_idea.author_id = v_uid and exists (select 1 from public.experts e
              where e.id = v_uid and e.status = 'approved')) or public.is_admin()) then
    raise exception 'only an approved expert author or an admin can verify' using errcode = '42501'; end if;
  if v_answer.status not in ('submitted','under_review') then
    raise exception 'answer is not awaiting a decision (status=%)', v_answer.status using errcode = 'P0001'; end if;
  if v_idea.status <> 'open' then
    raise exception 'idea is not open for verification (status=%)', v_idea.status using errcode = 'P0001'; end if;
  if p_payout_amount_cents is null or p_payout_amount_cents <= 0 then
    raise exception 'a positive intended payout is required to verify' using errcode = 'P0001'; end if;
  if v_idea.type = 'hypothesis' and (p_resolution is null or p_resolution not in ('yes','no','ambiguous')) then
    raise exception 'a resolution (yes|no|ambiguous) is required to verify a hypothesis' using errcode = 'P0001'; end if;

  update public.answers
    set status = 'verified', verified_by = v_uid, verified_at = now(), payout_amount_cents = p_payout_amount_cents
    where id = p_answer_id returning * into v_answer;

  if v_idea.type = 'hypothesis' then
    -- single winner: resolve the idea and auto-reject the rest (audit each), leaving no undecidable answers
    update public.ideas set status = 'resolved', resolution = p_resolution where id = v_idea.id;
    insert into public.answer_reviews (answer_id, actor_id, action, note_md)
      select id, v_uid, 'reject', 'auto-rejected: hypothesis resolved by another answer'
      from public.answers
      where idea_id = v_idea.id and id <> p_answer_id
        and status in ('submitted','under_review','revision_requested');
    update public.answers set status = 'rejected'
      where idea_id = v_idea.id and id <> p_answer_id
        and status in ('submitted','under_review','revision_requested');
  end if;

  insert into public.answer_reviews (answer_id, actor_id, action, note_md, amount_cents)
    values (p_answer_id, v_uid, 'verify', p_note, p_payout_amount_cents);
  return v_answer;
end; $$;
revoke all on function public.verify_answer(uuid, text, bigint, text) from public, anon;
grant execute on function public.verify_answer(uuid, text, bigint, text) to authenticated;

-- request_revision_answer: approved-expert author / admin asks the submitter to revise
create or replace function public.request_revision_answer(p_answer_id uuid, p_note text default null)
returns public.answers language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_answer public.answers; v_idea public.ideas;
begin
  if v_uid is null then raise exception 'auth required' using errcode = '42501'; end if;
  select * into v_answer from public.answers where id = p_answer_id for update;
  if not found then raise exception 'answer not found' using errcode = 'P0002'; end if;
  select * into v_idea from public.ideas where id = v_answer.idea_id;
  if not ((v_idea.author_id = v_uid and exists (select 1 from public.experts e
              where e.id = v_uid and e.status = 'approved')) or public.is_admin()) then
    raise exception 'only an approved expert author or an admin can request revision' using errcode = '42501'; end if;
  if v_answer.status not in ('submitted','under_review') then
    raise exception 'answer is not awaiting a decision (status=%)', v_answer.status using errcode = 'P0001'; end if;
  update public.answers set status = 'revision_requested' where id = p_answer_id returning * into v_answer;
  insert into public.answer_reviews (answer_id, actor_id, action, note_md)
    values (p_answer_id, v_uid, 'request_revision', p_note);
  return v_answer;
end; $$;
revoke all on function public.request_revision_answer(uuid, text) from public, anon;
grant execute on function public.request_revision_answer(uuid, text) to authenticated;

-- reject_answer: approved-expert author / admin rejects (may also close out an abandoned revision_requested answer)
create or replace function public.reject_answer(p_answer_id uuid, p_note text default null)
returns public.answers language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_answer public.answers; v_idea public.ideas;
begin
  if v_uid is null then raise exception 'auth required' using errcode = '42501'; end if;
  select * into v_answer from public.answers where id = p_answer_id for update;
  if not found then raise exception 'answer not found' using errcode = 'P0002'; end if;
  select * into v_idea from public.ideas where id = v_answer.idea_id;
  if not ((v_idea.author_id = v_uid and exists (select 1 from public.experts e
              where e.id = v_uid and e.status = 'approved')) or public.is_admin()) then
    raise exception 'only an approved expert author or an admin can reject' using errcode = '42501'; end if;
  if v_answer.status not in ('submitted','under_review','revision_requested') then
    raise exception 'answer is not in a rejectable state (status=%)', v_answer.status using errcode = 'P0001'; end if;
  update public.answers set status = 'rejected' where id = p_answer_id returning * into v_answer;
  insert into public.answer_reviews (answer_id, actor_id, action, note_md)
    values (p_answer_id, v_uid, 'reject', p_note);
  return v_answer;
end; $$;
revoke all on function public.reject_answer(uuid, text) from public, anon;
grant execute on function public.reject_answer(uuid, text) to authenticated;

-- resubmit_answer: submitter responds to a revision request (revision_requested -> submitted) on a still-open idea
create or replace function public.resubmit_answer(
  p_answer_id uuid, p_title text default null, p_explanation_md text default null)
returns public.answers language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_answer public.answers; v_idea public.ideas;
begin
  if v_uid is null then raise exception 'auth required' using errcode = '42501'; end if;
  select * into v_answer from public.answers where id = p_answer_id for update;
  if not found then raise exception 'answer not found' using errcode = 'P0002'; end if;
  if v_answer.submitter_id <> v_uid then
    raise exception 'only the submitter can resubmit' using errcode = '42501'; end if;
  if v_answer.status <> 'revision_requested' then
    raise exception 'answer is not awaiting revision (status=%)', v_answer.status using errcode = 'P0001'; end if;
  select * into v_idea from public.ideas where id = v_answer.idea_id;
  if v_idea.status <> 'open' then
    raise exception 'idea is no longer accepting answers (status=%)', v_idea.status using errcode = 'P0001'; end if;
  update public.answers
    set status = 'submitted',
        title = coalesce(nullif(p_title, ''), title),
        explanation_md = coalesce(p_explanation_md, explanation_md)
    where id = p_answer_id returning * into v_answer;
  insert into public.answer_reviews (answer_id, actor_id, action) values (p_answer_id, v_uid, 'resubmit');
  return v_answer;
end; $$;
revoke all on function public.resubmit_answer(uuid, text, text) from public, anon;
grant execute on function public.resubmit_answer(uuid, text, text) to authenticated;

-- admin_approve_payout: admin charitable-purpose gate (money OFF: records the decision; Phase 2 fires the ledger).
--   Locks the answer so two admins cannot approve-and-reject in a race; requires a real recorded payout amount.
create or replace function public.admin_approve_payout(p_answer_id uuid, p_note text default null)
returns public.answers language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_answer public.answers;
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
  return v_answer;
end; $$;
revoke all on function public.admin_approve_payout(uuid, text) from public, anon;
grant execute on function public.admin_approve_payout(uuid, text) to authenticated;

-- admin_reject_payout: admin declines the charitable-purpose gate (answer locked to prevent gate double-decide)
create or replace function public.admin_reject_payout(p_answer_id uuid, p_note text default null)
returns public.answers language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_answer public.answers;
begin
  if v_uid is null then raise exception 'auth required' using errcode = '42501'; end if;
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  select * into v_answer from public.answers where id = p_answer_id for update;
  if not found then raise exception 'answer not found' using errcode = 'P0002'; end if;
  if v_answer.status <> 'verified' then
    raise exception 'answer is not verified (status=%)', v_answer.status using errcode = 'P0001'; end if;
  if v_answer.admin_approved_at is not null or v_answer.admin_rejected_at is not null then
    raise exception 'gate already decided' using errcode = 'P0001'; end if;
  update public.answers set admin_rejected_by = v_uid, admin_rejected_at = now()
    where id = p_answer_id returning * into v_answer;
  insert into public.answer_reviews (answer_id, actor_id, action, note_md)
    values (p_answer_id, v_uid, 'admin_reject', p_note);
  return v_answer;
end; $$;
revoke all on function public.admin_reject_payout(uuid, text) from public, anon;
grant execute on function public.admin_reject_payout(uuid, text) to authenticated;
