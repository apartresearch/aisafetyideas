-- ============ answers (replaces the old "results") ============
create table public.answers (
  id                  uuid primary key default gen_random_uuid(),
  legacy_id           bigint unique,
  idea_id             uuid not null references public.ideas(id) on delete cascade,
  submitter_id        uuid references public.profiles(id) on delete set null,
  title               text not null,
  explanation_md      text,
  status              text not null default 'submitted'
                        check (status in ('submitted','under_review','revision_requested','verified','rejected')),
  verified_by         uuid references public.profiles(id) on delete set null,
  verified_at         timestamptz,
  admin_approved_by   uuid references public.profiles(id) on delete set null,
  admin_approved_at   timestamptz,
  admin_rejected_by   uuid references public.profiles(id) on delete set null,
  admin_rejected_at   timestamptz,
  payout_amount_cents bigint check (payout_amount_cents is null or payout_amount_cents >= 0),
  payout_currency     text not null default 'USD',
  legacy              jsonb not null default '{}'::jsonb,   -- lossless catch-all for old `results` columns
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table public.answers enable row level security;
create index answers_idea_id_idx on public.answers (idea_id);
create index answers_submitter_id_idx on public.answers (submitter_id);
create index answers_status_idx on public.answers (status);

-- SELECT: verified answers are public; submitter + idea-author + admin see any status (policies OR together)
create policy "verified answers readable by everyone" on public.answers for select
  using (status = 'verified');
create policy "submitter reads own answers" on public.answers for select to authenticated
  using ((select auth.uid()) = submitter_id);
create policy "idea author reads answers to own ideas" on public.answers for select to authenticated
  using (exists (select 1 from public.ideas i
                 where i.id = idea_id and i.author_id = (select auth.uid())));
create policy "admins read all answers" on public.answers for select to authenticated
  using (public.is_admin());

-- INSERT: any authenticated member submits their OWN answer to an OPEN idea; status + verification/payout +
-- legacy columns pinned so a client cannot pre-verify, self-pay, or squat a legacy_id (service-role-only).
create policy "members submit answers to open ideas" on public.answers for insert to authenticated
  with check (
    (select auth.uid()) = submitter_id
    and status = 'submitted'
    and verified_by is null and verified_at is null
    and admin_approved_by is null and admin_approved_at is null
    and admin_rejected_by is null and admin_rejected_at is null
    and payout_amount_cents is null
    and payout_currency = 'USD'
    and legacy_id is null and legacy = '{}'::jsonb
    and exists (select 1 from public.ideas i where i.id = idea_id and i.status = 'open')
  );

-- DELETE: submitter may withdraw an undecided answer (submitted only - a revision_requested answer
-- carries the author's review thread, and answer_reviews cascades, so withdrawing it would erase the audit trail)
create policy "submitter withdraws own submitted answer" on public.answers for delete to authenticated
  using ((select auth.uid()) = submitter_id and status = 'submitted');

-- NOTE: NO update policy on purpose - all status transitions go through SECURITY DEFINER RPCs (next migration).

-- updated_at trigger (touch_updated_at() created in Plan 2; search_path already locked)
create trigger answers_touch_updated_at before update on public.answers
  for each row execute function public.touch_updated_at();

-- ============ answer_artifacts (links: github | pdf | colab | url | other) ============
create table public.answer_artifacts (
  id         uuid primary key default gen_random_uuid(),
  legacy_id  bigint unique,
  answer_id  uuid not null references public.answers(id) on delete cascade,
  kind       text not null default 'url' check (kind in ('github','pdf','colab','url','other')),
  url        text not null,
  label      text,
  legacy     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.answer_artifacts enable row level security;
create index answer_artifacts_answer_id_idx on public.answer_artifacts (answer_id);

-- SELECT: visible exactly when the parent answer is visible to the caller
create policy "artifacts readable when parent answer is" on public.answer_artifacts for select
  using (exists (
    select 1 from public.answers a
    where a.id = answer_id
      and (a.status = 'verified'
           or (select auth.uid()) = a.submitter_id
           or exists (select 1 from public.ideas i where i.id = a.idea_id and i.author_id = (select auth.uid()))
           or public.is_admin())
  ));
-- INSERT: parent submitter while the answer is still editable; legacy columns pinned (service-role-only)
create policy "submitter adds artifacts to editable answer" on public.answer_artifacts for insert to authenticated
  with check (
    legacy_id is null and legacy = '{}'::jsonb
    and exists (
      select 1 from public.answers a
      where a.id = answer_id and a.submitter_id = (select auth.uid())
        and a.status in ('submitted','revision_requested')
    )
  );
-- DELETE: same gate
create policy "submitter removes artifacts from editable answer" on public.answer_artifacts for delete to authenticated
  using (exists (
    select 1 from public.answers a
    where a.id = answer_id and a.submitter_id = (select auth.uid())
      and a.status in ('submitted','revision_requested')
  ));

-- ============ answer_reviews (append-only audit trail; written only by the RPCs) ============
create table public.answer_reviews (
  id           uuid primary key default gen_random_uuid(),
  legacy_id    bigint unique,
  answer_id    uuid not null references public.answers(id) on delete cascade,
  actor_id     uuid references public.profiles(id) on delete set null,
  action       text not null check (action in
                 ('start_review','verify','reject','request_revision','resubmit','admin_approve','admin_reject')),
  note_md      text,
  amount_cents bigint,           -- intended payout recorded at verify/admin actions (Phase 1: informational)
  created_at   timestamptz not null default now()
);
alter table public.answer_reviews enable row level security;
create index answer_reviews_answer_id_idx on public.answer_reviews (answer_id);

-- SELECT: involved parties (submitter, idea author) + admins
create policy "reviews readable by involved parties" on public.answer_reviews for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.answers a
      where a.id = answer_id
        and ((select auth.uid()) = a.submitter_id
             or exists (select 1 from public.ideas i where i.id = a.idea_id and i.author_id = (select auth.uid())))
    )
  );
-- NOTE: NO insert/update/delete policy - only the SECURITY DEFINER RPCs write here (deny-by-default for clients).
