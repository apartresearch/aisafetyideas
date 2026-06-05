# AI Safety Ideas — Phase 1 · Plan 3: Answers & Verification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the **answers** domain — `answers` + `answer_artifacts` + `answer_reviews` — and the full **verify / request-revision / reject** flow plus the **admin charitable-purpose gate** (recording *intended* payouts, **money OFF**), all RLS-secured, on the `plan-3-answers-verification` branch. Schema absorbs the old `results` columns via `legacy_id` + `legacy jsonb` for a lossless ETL.

**Architecture:** Builds on Plan 1 (identity/`is_admin()`/`touch_updated_at()`) + Plan 2 (`ideas`). Reads go through RLS-scoped `load()`; **answer state transitions go through `SECURITY DEFINER` RPCs** (locked `search_path=''`, internal `auth.uid()` checks, state-machine validation, audit row) — there is **no client UPDATE policy on `answers`** (deny-by-default). Initial submission is a plain RLS INSERT (status pinned to `submitted`). This mirrors the spec ("verify/reject: idea author or admin via RPC") and is the seam Phase 2 extends to fire real ledger entries.

**Tech Stack:** unchanged from Plans 1–2 (SvelteKit 2 + Svelte 5 runes + Supabase v2 + `@supabase/ssr`, pgTAP, Playwright, Vitest, Tailwind v4).

**Cloud note (controller-handled, NOT a subagent task):** subagents develop + test against the **local** stack only. After the migrations are finalized and reviewed, the controller applies them to cloud `gjomchhbsbtauzkpyjwa` via the Supabase MCP. Subagents must NOT touch the cloud, `CLAUDE.md`, `docs/`, `.claude/`, or `src_legacy_v0/`.

---

## Key design decisions

- **Money OFF (per spec §7/§10).** The verify → admin-approve flow runs fully and records an **intended** payout on `answers.payout_amount_cents` + the `answer_reviews` audit trail. **No** `ledger_*` / `payouts` / `donations` tables in this plan — those land in the Phase-2 money plan. The admin gate is recorded as `answers.admin_approved_by/at` (or `admin_rejected_by/at`).
- **Transitions via RPC, not RLS UPDATE.** `answers` has SELECT, INSERT, and DELETE policies only. Every status change is a `SECURITY DEFINER` function that authorizes internally and writes an `answer_reviews` row atomically. This prevents an author from rewriting answer content, prevents a submitter from self-verifying or setting a payout, and gives a tamper-evident audit trail.
- **Submission is RLS INSERT** with a pinned `WITH CHECK` (`submitter_id = auth.uid()`, `status = 'submitted'`, all verification/payout columns null, target idea must be `open`). No RPC needed for the happy-path submit; artifacts are child RLS inserts.
- **State machine (spec §5):** `submitted → under_review → {verified | revision_requested → (resubmit) → submitted | rejected}`; gate `verified → {admin_approved | admin_rejected}`.
- **Hypothesis = single winner.** Verifying an answer on a `hypothesis` idea sets the idea to `resolved` (+ optional `resolution`) and blocks further submissions/verifications (RPC guards `idea.status = 'open'`). Open-ended ideas stay `open` and can accrue multiple verified answers.
- **`submitter_id` is `on delete set null`** (an answer outlives a deleted account; the original author name also rides in `legacy`), mirroring `ideas.author_id`. Live inserts always set it (RLS pins it); the ETL inserts old rows via service-role.
- **Lossless ETL anchors:** `legacy_id bigint unique` + `legacy jsonb` on `answers` and `answer_artifacts`. Old `results` columns map: `id→legacy_id`, `description→explanation_md`, `title→title`, `link`/`image_link`→`answer_artifacts`, and `idea`/`user`/`type`/`author`/`from_date`/`original`→`legacy` (resolved/promoted during the ETL). Old `results` had **no** verify/reject state, so the ETL imports them as `submitted`.
- **No `@html`.** Markdown bodies render as text for now (sanitized rendering is Plan 5), matching Plan 2.
- **Verify→payout signature animation is deferred to Plan 5 (polish).** Plan 3 ships the functional, accessible, reduced-motion-safe flow: the `verified` badge turns green (`--green` accent). The full FLIP/stroke-dashoffset/count-up choreography from `CLAUDE.md` §5 is Plan 5.
- **Auto-resolve timeout is deferred to the Phase-2 money plan** (spec §7 frames it as an escrow safeguard). `ideas.auto_resolve_days` already exists (Plan 2); no cron in Plan 3.

### Authorization, integrity & concurrency (hardened after adversarial plan review)
- **Authority is the RPC, never the UI.** Each author-facing RPC re-checks `experts.status = 'approved'` (OR `is_admin()`), so a **revoked expert loses verify/reject power immediately** — matching the `ideas` INSERT gate. The console's `requireExpert()` is defense-in-depth, not the boundary.
- **Single-winner is lock-enforced.** `verify_answer` takes `FOR UPDATE` on the answer **and** the idea before its open-check, so concurrent verifies on one hypothesis serialize — exactly one winner. The admin-gate RPCs take `FOR UPDATE` on the answer so the gate cannot be approved-and-rejected by a race. (Phase 1 concurrency is low, but this is the seam Phase 2 hangs real money on — it must be correct now.)
- **General open-idea guard.** Every transition that produces a "winner" or re-queues work (`verify_answer`, `start_review`, `resubmit_answer`) requires `idea.status = 'open'`, mirroring the INSERT policy — no verifying/resubmitting on a closed, archived, or resolved idea.
- **No stuck states.** When a hypothesis resolves, `verify_answer` **auto-rejects every other undecided answer** on that idea (`submitted`/`under_review`/`revision_requested` → `rejected`) and writes an audit row for each. `reject_answer` may also fire from `revision_requested`, so an author can close out an abandoned revision.
- **Verify records a real, non-fabricated decision.** `verify_answer` **requires `payout_amount_cents > 0`** (Phase-1 records *intended* payouts; a meaningless NULL grant is rejected) and **requires `p_resolution ∈ {yes,no,ambiguous}` for hypotheses** (no silent `'yes'` default — that would invent a research outcome). The payout is **immutable post-verify** in Phase 1 (no amend RPC; correct an over/under via admin reject). A Phase-2 `payout ≤ escrow` pot check is a documented TODO anchored on this RPC.
- **Payout-gate state is intentionally derived.** Per §10's "additive, no migration" promise, the gate is tracked by `status='verified'` + `admin_approved_at`/`admin_rejected_at` nullability (no `pending_admin`/`paid` enum on `answers`). The Phase-2 `paid` state lives on the future `payouts`/`ledger_*` tables, not on `answers`, so the no-migration claim holds.
- **`legacy_*` is service-role-only.** The `answers` and `answer_artifacts` INSERT WITH CHECK pin `legacy_id IS NULL AND legacy = '{}'` (and `payout_currency='USD'`) so a live client cannot squat a `legacy_id` (UNIQUE) and break the lossless ETL, nor forge `legacy` provenance.
- **Withdraw is `submitted`-only.** The DELETE policy allows withdrawing only an undecided `submitted` answer — a `revision_requested` answer carries the author's review thread, and `answer_reviews` cascades on delete, so withdrawing it would erase the tamper-evident trail.
- **Schema deltas vs spec §6 DDL (intentional, additive):** `payout_currency` mirrors `ideas.currency`; `admin_rejected_by/at` record the §5 `admin_rejected` gate branch; the `answer_reviews.action` enum extends §6 with `start_review`/`resubmit` to fully audit the §5 state machine. Open-ended ideas intentionally stay `open` on verify (the `closed` transition is a Phase-2 funder/pot action).
- **`answer_reviews` ETL:** the old `results` table had **no** per-decision review history, so `answer_reviews` imports **zero** legacy rows; its `legacy_id` stays null for live data and is reserved for any future legacy verification-relation back-fill.

---

## File structure (Plan 3)

| File | Responsibility |
|---|---|
| `supabase/migrations/<ts>_answers.sql` | `answers`, `answer_artifacts`, `answer_reviews` + RLS + indexes + `touch_updated_at` trigger |
| `supabase/migrations/<ts>_answer_rpcs.sql` | transition RPCs (`start_review`, `verify_answer`, `request_revision_answer`, `reject_answer`, `resubmit_answer`, `admin_approve_payout`, `admin_reject_payout`) |
| `supabase/tests/database/answers_test.sql` | pgTAP RLS + RPC tests |
| `src/lib/types/database.ts` | Regenerated types (tables + RPC functions) |
| `src/lib/artifacts.ts` | `KINDS` + pure `inferKind(url)` helper (unit-tested) |
| `src/lib/components/StatusBadge.svelte` | **Modify**: add answer statuses + tones |
| `src/lib/components/Money.svelte`, `AnswerCard.svelte` | New presentation components |
| `src/routes/ideas/[id]/answer/+page.server.ts` / `+page.svelte` | Submit an answer (auth-gated) |
| `src/routes/ideas/[id]/+page.server.ts` / `+page.svelte` | **Modify**: load + show answers + submit CTA |
| `src/routes/console/+page.server.ts` / `+page.svelte` | **Modify**: add review queue + verify/request-revision/reject actions |
| `src/routes/admin/payouts/+page.server.ts` / `+page.svelte` | New: admin charitable-purpose gate queue |
| `src/lib/artifacts.test.ts`, `e2e/answers.spec.ts` | Unit + E2E |

---

## Task 1: Migration — answers / answer_artifacts / answer_reviews schema + RLS

**Files:** `supabase/migrations/<ts>_answers.sql`

- [ ] **Step 1: Create the migration**

`supabase migration new answers`, contents:

```sql
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

-- DELETE: submitter may withdraw an undecided answer (submitted only — a revision_requested answer
-- carries the author's review thread, and answer_reviews cascades, so withdrawing it would erase the audit trail)
create policy "submitter withdraws own submitted answer" on public.answers for delete to authenticated
  using ((select auth.uid()) = submitter_id and status = 'submitted');

-- NOTE: NO update policy on purpose — all status transitions go through SECURITY DEFINER RPCs (next migration).

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
-- NOTE: NO insert/update/delete policy — only the SECURITY DEFINER RPCs write here (deny-by-default for clients).
```

- [ ] **Step 2: Apply locally**

Run: `supabase db reset`
Expected: all migrations (Plans 1–3) apply with no errors.

- [ ] **Step 3: Smoke-check tables + policy counts**

Run: `docker exec supabase_db_aisafetyideas psql -U postgres -d postgres -c "\dt public.*"`
Expected: includes `answers`, `answer_artifacts`, `answer_reviews` (plus the Plan 1–2 tables).
Run: `docker exec supabase_db_aisafetyideas psql -U postgres -d postgres -c "select tablename, count(*) from pg_policies where schemaname='public' and tablename like 'answer%' group by 1 order by 1;"`
Expected: `answers` = 6 (4 select + 1 insert + 1 delete), `answer_artifacts` = 3 (1 select + 1 insert + 1 delete), `answer_reviews` = 1 (select only).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): answers/answer_artifacts/answer_reviews schema + RLS (Plan 3)"
```

---

## Task 2: Migration — answer transition RPCs (SECURITY DEFINER)

**Files:** `supabase/migrations/<ts>_answer_rpcs.sql`

All functions: `security definer`, `set search_path = ''`, fully schema-qualified, `auth.uid()` authorization inside, state-machine validation, write an `answer_reviews` row, then `revoke all from public, anon` + `grant execute to authenticated`. Authorization errors raise `42501`; state-machine violations raise `P0001`; not-found raises `P0002`.

- [ ] **Step 1: Create the migration**

`supabase migration new answer_rpcs`, contents:

```sql
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
```

- [ ] **Step 2: Apply locally + advisors**

Run: `supabase db reset`
Expected: applies clean.
Run: `supabase db advisors --level warning` (or MCP `get_advisors` if CLI < 2.81.3).
Expected: no NEW `function_search_path_mutable` warnings (all RPCs set `search_path=''`). The pre-existing accepted `is_admin` SECURITY DEFINER advisor may remain; do NOT add `SECURITY DEFINER` anywhere to silence an unrelated error. If a new advisor fires on these functions, fix the function — do not weaken it. An **informational** note that `answer_reviews` has RLS enabled with no write policy is **expected and intentional** (deny-by-default; only the RPCs, running as the table owner, write it) — do NOT "fix" it by adding a write policy.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): answer transition RPCs (verify/revision/reject/resubmit/admin gate) — SECURITY DEFINER, locked search_path"
```

---

## Task 3: pgTAP RLS + RPC tests

**Files:** `supabase/tests/database/answers_test.sql`

- [ ] **Step 1: Write the test**

```sql
begin;
select plan(43);

-- ── seed 5 users (handle_new_user trigger creates a profile per auth.users insert) ──
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','alice@example.com','x', now(), now(), now()),  -- author (approved expert)
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','bob@example.com','x', now(), now(), now()),    -- submitter
  ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333','authenticated','authenticated','carol@example.com','x', now(), now(), now()),  -- admin
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','dave@example.com','x', now(), now(), now()),   -- unrelated
  ('00000000-0000-0000-0000-000000000000','55555555-5555-5555-5555-555555555555','authenticated','authenticated','eve@example.com','x', now(), now(), now());    -- REVOKED expert

update public.profiles set is_admin = true where id = '33333333-3333-3333-3333-333333333333';
insert into public.experts (id, status) values
  ('11111111-1111-1111-1111-111111111111','approved'),
  ('55555555-5555-5555-5555-555555555555','revoked');

-- seed ideas (as superuser; RLS not in force here). O/O2/H/D by alice; E by eve.
insert into public.ideas (id, author_id, type, title, status) values
  ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','open_ended','Open idea','open'),
  ('a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','open_ended','Open idea 2','open'),
  ('a0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','hypothesis','Hyp idea','open'),
  ('a0000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','open_ended','Draft idea','draft'),
  ('a0000000-0000-0000-0000-000000000005','55555555-5555-5555-5555-555555555555','open_ended','Eve idea','open');

set local role authenticated;

-- ========== bob (submitter) ==========
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into public.answers (id, idea_id, submitter_id, title)
  values ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Bob answer');
select ok((select count(*) from public.answers) = 1, '1: member submits answer to open idea');                                            -- 1
select throws_ok($$ insert into public.answers (idea_id, submitter_id, title, status)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','sneaky','verified') $$,
  '42501', null, '2: cannot insert pre-verified answer');                                                                                 -- 2
select throws_ok($$ insert into public.answers (idea_id, submitter_id, title)
  values ('a0000000-0000-0000-0000-000000000004','22222222-2222-2222-2222-222222222222','to draft') $$,
  '42501', null, '3: cannot submit answer to draft idea');                                                                                -- 3
select throws_ok($$ insert into public.answers (idea_id, submitter_id, title, legacy_id)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','squat', 5) $$,
  '42501', null, '4: cannot set legacy_id on a live insert (service-role only)');                                                          -- 4
insert into public.answer_artifacts (answer_id, url, kind)
  values ('b0000000-0000-0000-0000-000000000001','https://github.com/x/y','github');
select ok((select count(*) from public.answer_artifacts) = 1, '5: submitter adds artifact to editable answer');                          -- 5
select ok((select count(*) from public.answers where id='b0000000-0000-0000-0000-000000000001') = 1,
  '6: submitter reads own submitted answer');                                                                                            -- 6

-- ========== dave (unrelated) ==========
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select ok((select count(*) from public.answers) = 0, '7: unrelated user cannot read a non-verified answer');                             -- 7
select ok((select count(*) from public.answer_artifacts) = 0, '8: unrelated user cannot read artifacts of a non-verified answer');      -- 8
select throws_ok($$ insert into public.answer_artifacts (answer_id, url)
  values ('b0000000-0000-0000-0000-000000000001','https://evil') $$,
  '42501', null, '9: unrelated user cannot add an artifact');                                                                            -- 9
select throws_ok($$ select public.verify_answer('b0000000-0000-0000-0000-000000000001') $$,
  '42501', null, '10: unrelated user cannot verify (auth checked before payout)');                                                       -- 10

-- ========== alice (approved-expert author): no direct UPDATE; review transitions ==========
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
update public.answers set title = 'hacked' where id = 'b0000000-0000-0000-0000-000000000001';
select is((select title from public.answers where id='b0000000-0000-0000-0000-000000000001'),
  'Bob answer', '11: no direct client UPDATE on answers (0 rows, no policy)');                                                            -- 11
select lives_ok($$ select public.start_review('b0000000-0000-0000-0000-000000000001') $$, '12: author starts review');                  -- 12
select is((select status from public.answers where id='b0000000-0000-0000-0000-000000000001'),
  'under_review', '13: answer moved to under_review');                                                                                   -- 13
select lives_ok($$ select public.request_revision_answer('b0000000-0000-0000-0000-000000000001','add code') $$,
  '14: author requests revision');                                                                                                       -- 14
select is((select status from public.answers where id='b0000000-0000-0000-0000-000000000001'),
  'revision_requested', '15: answer moved to revision_requested');                                                                       -- 15

-- ========== bob resubmits ==========
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select lives_ok($$ select public.resubmit_answer('b0000000-0000-0000-0000-000000000001', null, 'now with code') $$,
  '16: submitter resubmits');                                                                                                            -- 16
select is((select status from public.answers where id='b0000000-0000-0000-0000-000000000001'),
  'submitted', '17: answer back to submitted');                                                                                          -- 17

-- ========== alice verifies (open-ended: idea stays open) ==========
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select throws_ok($$ select public.verify_answer('b0000000-0000-0000-0000-000000000001','x', null, null) $$,
  'P0001', null, '18: verify requires a positive intended payout');                                                                      -- 18
select lives_ok($$ select public.verify_answer('b0000000-0000-0000-0000-000000000001','great', 50000, null) $$,
  '19: author verifies with a recorded payout');                                                                                         -- 19
select is((select status from public.answers where id='b0000000-0000-0000-0000-000000000001'),
  'verified', '20: answer verified');                                                                                                     -- 20
select is((select payout_amount_cents from public.answers where id='b0000000-0000-0000-0000-000000000001'),
  50000::bigint, '21: intended payout recorded');                                                                                        -- 21
select ok((select count(*) from public.answer_reviews
  where answer_id='b0000000-0000-0000-0000-000000000001' and action='verify') = 1,
  '22: verify wrote an audit row');                                                                                                       -- 22
select is((select status from public.ideas where id='a0000000-0000-0000-0000-000000000001'),
  'open', '23: open-ended idea stays open on verify');                                                                                    -- 23

-- ========== anon: verified answer is public ==========
set local role anon;
select ok((select count(*) from public.answers where status='verified') = 1, '24: verified answer is public to anon');                  -- 24

-- ========== bob: audit table is deny-by-default for writes ==========
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select throws_ok($$ insert into public.answer_reviews (answer_id, actor_id, action)
  values ('b0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','verify') $$,
  '42501', null, '25: client cannot write the audit table');                                                                             -- 25

-- ========== hypothesis single-winner + auto-reject of losers ==========
insert into public.answers (id, idea_id, submitter_id, title) values
  ('b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','Hyp winner'),
  ('b0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','Hyp loser');
select ok((select count(*) from public.answers where idea_id='a0000000-0000-0000-0000-000000000003') = 2,
  '26: two answers submitted to the hypothesis idea');                                                                                   -- 26
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok($$ select public.verify_answer('b0000000-0000-0000-0000-000000000002','win', 10000, 'yes') $$,
  '27: author verifies the hypothesis winner');                                                                                          -- 27
select is((select status from public.ideas where id='a0000000-0000-0000-0000-000000000003'),
  'resolved', '28: hypothesis idea resolves on verify');                                                                                 -- 28
select is((select status from public.answers where id='b0000000-0000-0000-0000-000000000002'),
  'verified', '29: winner verified');                                                                                                     -- 29
select is((select status from public.answers where id='b0000000-0000-0000-0000-000000000003'),
  'rejected', '30: losing answer auto-rejected on resolution');                                                                          -- 30
select throws_ok($$ select public.verify_answer('b0000000-0000-0000-0000-000000000003','x', 1, 'yes') $$,
  'P0001', null, '31: cannot verify an answer that is no longer awaiting a decision');                                                    -- 31
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select throws_ok($$ insert into public.answers (id, idea_id, submitter_id, title)
  values ('b0000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','late') $$,
  '42501', null, '32: cannot submit a new answer to a resolved idea');                                                                    -- 32

-- ========== admin charitable-purpose gate ==========
select throws_ok($$ select public.admin_approve_payout('b0000000-0000-0000-0000-000000000001') $$,
  '42501', null, '33: non-admin cannot approve the payout gate');                                                                        -- 33
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select lives_ok($$ select public.admin_approve_payout('b0000000-0000-0000-0000-000000000001','charitable purpose ok') $$,
  '34: admin approves the payout gate');                                                                                                  -- 34
select ok((select admin_approved_by='33333333-3333-3333-3333-333333333333' and admin_approved_at is not null
  from public.answers where id='b0000000-0000-0000-0000-000000000001'), '35: admin approval recorded');                                  -- 35
select throws_ok($$ select public.admin_reject_payout('b0000000-0000-0000-0000-000000000001') $$,
  'P0001', null, '36: gate cannot be decided twice');                                                                                    -- 36
select lives_ok($$ select public.admin_reject_payout('b0000000-0000-0000-0000-000000000002','not this time') $$,
  '37: admin rejects another verified answer');                                                                                          -- 37
select ok((select admin_rejected_at is not null from public.answers where id='b0000000-0000-0000-0000-000000000002'),
  '38: admin rejection recorded');                                                                                                        -- 38

-- ========== author may reject a stalled revision_requested answer ==========
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into public.answers (id, idea_id, submitter_id, title)
  values ('b0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','O2 answer');
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok($$ select public.request_revision_answer('b0000000-0000-0000-0000-000000000004','revise') $$,
  '39: author requests revision on the O2 answer');                                                                                      -- 39
select lives_ok($$ select public.reject_answer('b0000000-0000-0000-0000-000000000004','closing out') $$,
  '40: author rejects a revision_requested answer');                                                                                     -- 40
select is((select status from public.answers where id='b0000000-0000-0000-0000-000000000004'),
  'rejected', '41: revision_requested answer can be rejected');                                                                          -- 41

-- ========== revoked expert cannot verify, even on their own idea ==========
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into public.answers (id, idea_id, submitter_id, title)
  values ('b0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000005','22222222-2222-2222-2222-222222222222','Answer to Eve idea');
set local request.jwt.claims = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';
select throws_ok($$ select public.verify_answer('b0000000-0000-0000-0000-000000000005','x', 5000, null) $$,
  '42501', null, '42: a revoked expert cannot verify (RPC re-checks experts.status, not just the UI)');                                  -- 42

-- ========== structural: answer_reviews is deny-by-default (only a SELECT policy) ==========
select is((select count(*)::int from pg_policies where schemaname='public' and tablename='answer_reviews'),
  1, '43: answer_reviews has exactly one (select-only) policy');                                                                          -- 43

select * from finish();
rollback;
```

- [ ] **Step 2: Run**

Run: `supabase test db`
Expected: **43/43** pass (this file). If a policy/RPC is wrong, fix the migration (Task 1/2) and re-run. Do NOT weaken RLS or remove an auth check to make a test pass. If you add/remove an assertion, update `select plan(N)` to the exact count (`grep -cE 'select (ok|is|throws_ok|lives_ok)\(' answers_test.sql` must equal N).

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/database/answers_test.sql
git commit -m "test(db): pgTAP RLS + RPC tests for answers/verification"
```

---

## Task 4: Regenerate types + artifacts helper + presentation components

**Files:** `src/lib/types/database.ts`, `src/lib/artifacts.ts`, `src/lib/components/StatusBadge.svelte` (modify), `src/lib/components/Money.svelte`, `src/lib/components/AnswerCard.svelte`

- [ ] **Step 1: Regenerate types**

Run: `supabase gen types typescript --local 2>/dev/null > src/lib/types/database.ts`
Confirm `answers`, `answer_artifacts`, `answer_reviews` appear under `Tables`, and `verify_answer`, `admin_approve_payout`, etc. appear under `Functions`.

- [ ] **Step 2: `src/lib/artifacts.ts`** (pure, unit-testable)

```ts
export const KINDS = ['github', 'pdf', 'colab', 'url', 'other'] as const;
export type ArtifactKind = (typeof KINDS)[number];

export function inferKind(url: string): ArtifactKind {
  const u = url.trim().toLowerCase();
  if (u.includes('github.com')) return 'github';
  if (u.includes('colab.research.google.com')) return 'colab';
  if (u.endsWith('.pdf')) return 'pdf';
  if (u.startsWith('http://') || u.startsWith('https://')) return 'url';
  return 'other';
}
```

- [ ] **Step 3: Modify `StatusBadge.svelte`** to cover answer statuses + tones (green accent for positive states, pink for rejected, amber for revision)

```svelte
<script lang="ts">
  let { status }: { status: string } = $props();
  const label: Record<string, string> = {
    open: 'Open', resolved: 'Resolved', closed: 'Closed', draft: 'Draft', archived: 'Archived',
    submitted: 'Submitted', under_review: 'Under review', revision_requested: 'Revision requested',
    verified: 'Verified', rejected: 'Rejected'
  };
  const tone: Record<string, 'accent' | 'neg' | 'warn'> = {
    open: 'accent', resolved: 'accent', verified: 'accent',
    rejected: 'neg', revision_requested: 'warn'
  };
  const t = $derived(tone[status]);
</script>
<span class="rounded-full px-2 py-0.5 text-xs font-medium"
      style="border:1px solid var(--line); color:var(--muted);
             {t === 'accent' ? 'color:var(--green-deep); border-color:var(--green);' : ''}
             {t === 'neg' ? 'color:var(--neg); border-color:var(--neg);' : ''}
             {t === 'warn' ? 'color:var(--warn); border-color:var(--warn);' : ''}">
  {label[status] ?? status}
</span>
```

- [ ] **Step 4: `Money.svelte`** (tabular-nums per CLAUDE.md)

```svelte
<script lang="ts">
  let { cents, currency = 'USD' }: { cents: number | null | undefined; currency?: string } = $props();
  const fmt = $derived(
    cents == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)
  );
</script>
<span style="font-variant-numeric: tabular-nums">{fmt}</span>
```

- [ ] **Step 5: `AnswerCard.svelte`**

```svelte
<script lang="ts">
  import StatusBadge from './StatusBadge.svelte';
  import Money from './Money.svelte';
  type Artifact = { id: string; kind: string; url: string; label: string | null };
  let { answer }: {
    answer: {
      id: string; title: string; explanation_md: string | null; status: string;
      payout_amount_cents: number | null; answer_artifacts?: Artifact[] | null;
      submitter?: { handle: string; display_name: string | null } | null;
    }
  } = $props();
</script>
<article class="rounded-2xl border p-5" style="border-color:var(--line); background:var(--surface); box-shadow:var(--shadow-1)">
  <div class="mb-1 flex items-center justify-between gap-2">
    <h3 class="font-bold" style="color:var(--ink)">{answer.title}</h3>
    <StatusBadge status={answer.status} />
  </div>
  {#if answer.submitter}<p class="text-sm" style="color:var(--faint)">by {answer.submitter.display_name ?? answer.submitter.handle}</p>{/if}
  {#if answer.explanation_md}<p class="mt-2 whitespace-pre-wrap text-sm" style="color:var(--body)">{answer.explanation_md}</p>{/if}
  {#if answer.answer_artifacts?.length}
    <ul class="mt-3 flex flex-col gap-1 text-sm">
      {#each answer.answer_artifacts as a (a.id)}
        <li><a href={a.url} target="_blank" rel="noopener" style="color:var(--green-deep)">{a.label ?? a.kind} ↗</a></li>
      {/each}
    </ul>
  {/if}
  {#if answer.status === 'verified' && answer.payout_amount_cents != null}
    <p class="mt-3 text-sm" style="color:var(--muted)">Intended payout: <Money cents={answer.payout_amount_cents} /></p>
  {/if}
</article>
```

- [ ] **Step 6: Verify** `npm run check` (0 errors) and `npm run build` (clean).

- [ ] **Step 7: Commit**

```bash
git add src/lib
git commit -m "feat: regenerate types + artifacts helper + Money/AnswerCard + StatusBadge answer states"
```

---

## Task 5: Submit an answer — `/ideas/[id]/answer`

**Files:** `src/routes/ideas/[id]/answer/+page.server.ts`, `src/routes/ideas/[id]/answer/+page.svelte`

- [ ] **Step 1: `+page.server.ts`**

```ts
import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { inferKind } from '$lib/artifacts';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) redirect(303, `/login?next=/ideas/${params.id}/answer`);
  const { data: idea } = await supabase
    .from('ideas').select('id, title, type, status').eq('id', params.id).single();
  if (!idea) error(404, 'Idea not found');
  if (idea.status !== 'open') error(400, 'This idea is not accepting answers');
  return { idea };
};

export const actions: Actions = {
  default: async ({ request, params, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in to submit an answer' });
    const fd = await request.formData();
    const title = String(fd.get('title') ?? '').trim();
    const explanation_md = String(fd.get('explanation_md') ?? '').trim();
    if (!title) return fail(400, { message: 'Title is required', title, explanation_md });

    // RLS enforces submitter = self, status pinned, and idea must be open
    const { data: answer, error: e } = await supabase
      .from('answers')
      .insert({ idea_id: params.id, submitter_id: user.id, title, explanation_md, status: 'submitted' })
      .select('id').single();
    if (e || !answer) return fail(400, { message: e?.message ?? 'Could not submit answer' });

    const urls = String(fd.get('artifacts') ?? '')
      .split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 5);
    if (urls.length) {
      const rows = urls.map((url) => ({ answer_id: answer.id, url, kind: inferKind(url) }));
      const { error: ae } = await supabase.from('answer_artifacts').insert(rows);
      if (ae) return fail(400, { message: `Answer saved, but artifacts failed: ${ae.message}` });
    }
    redirect(303, `/ideas/${params.id}`);
  }
};
```

- [ ] **Step 2: `+page.svelte`**

```svelte
<script lang="ts">
  let { data, form } = $props();
</script>
<h1 class="mb-1 text-2xl font-bold" style="color:var(--ink)">Submit an answer</h1>
<p class="mb-6 text-sm" style="color:var(--muted)">for <a href="/ideas/{data.idea.id}" style="color:var(--green-deep)">{data.idea.title}</a></p>
<form method="POST" class="flex flex-col gap-3 rounded-2xl border p-5" style="border-color:var(--line); background:var(--surface)">
  <input name="title" placeholder="Answer title" required value={form?.title ?? ''}
         class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
  <textarea name="explanation_md" placeholder="Explain your answer (markdown)" rows="6"
            class="rounded-xl border px-3 py-2" style="border-color:var(--line)">{form?.explanation_md ?? ''}</textarea>
  <textarea name="artifacts" placeholder="Artifact links — one per line (GitHub, PDF, Colab, URL)" rows="3"
            class="rounded-xl border px-3 py-2" style="border-color:var(--line)"></textarea>
  <button class="self-start rounded-xl px-4 py-2 font-medium" style="background:var(--ink); color:#fff">Submit</button>
  {#if form?.message}<span style="color:var(--neg)">{form.message}</span>{/if}
</form>
```

- [ ] **Step 3: Verify** `npm run check` + `npm run build`.

- [ ] **Step 4: Commit** `git add src/routes/ideas && git commit -m "feat: submit-answer route with artifact links (auth-gated)"`

---

## Task 6: Idea detail — show answers + submit CTA

**Files:** `src/routes/ideas/[id]/+page.server.ts` (modify), `src/routes/ideas/[id]/+page.svelte` (modify)

- [ ] **Step 1: Replace `+page.server.ts`** (adds session + answers load to the Plan 2 version)

```ts
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  const { data: idea } = await supabase
    .from('ideas')
    .select('id, title, summary_md, claim, type, status, resolution, estimated_hours, importance, source_url, author_id')
    .eq('id', params.id)
    .single(); // RLS returns null if not visible (another user's draft)
  if (!idea) error(404, 'Idea not found');

  const { data: author } = idea.author_id
    ? await supabase.from('profiles').select('handle, display_name').eq('id', idea.author_id).single()
    : { data: null };

  const { data: cats } = await supabase
    .from('idea_categories').select('categories(slug, title)').eq('idea_id', idea.id);

  // RLS scopes which answers are returned: verified (public) + own + (for the author) all answers to this idea.
  // answers has FOUR FKs to profiles, so the submitter embed MUST name the constraint to disambiguate.
  const { data: rawAnswers } = await supabase
    .from('answers')
    .select(
      'id, title, explanation_md, status, payout_amount_cents, submitter_id,' +
        ' answer_artifacts(id, kind, url, label),' +
        ' submitter:profiles!answers_submitter_id_fkey(handle, display_name)'
    )
    .eq('idea_id', idea.id)
    .order('created_at', { ascending: true });

  // Normalise the to-one `submitter` embed (supabase-js may type/return it as an array) and hand AnswerCard a
  // plain shape. Mapping through `(a: any)` matches the Plan-2 embed precedent and keeps `npm run check` at 0 errors.
  const answers = (rawAnswers ?? []).map((a: any) => ({
    ...a,
    submitter: Array.isArray(a.submitter) ? (a.submitter[0] ?? null) : a.submitter
  }));

  return {
    idea,
    author,
    categories: (cats ?? []).map((c: any) => c.categories),
    answers,
    canSubmit: !!user && idea.status === 'open'
  };
};
```

- [ ] **Step 2: Replace `+page.svelte`** (adds the Answers section + CTA to the Plan 2 version)

```svelte
<script lang="ts">
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import AnswerCard from '$lib/components/AnswerCard.svelte';
  let { data } = $props();
</script>
<article class="rounded-2xl border p-6" style="border-color:var(--line); background:var(--surface); box-shadow:var(--shadow-1)">
  <div class="mb-2 flex items-center justify-between">
    <span class="text-xs uppercase tracking-wide" style="color:var(--faint)">{data.idea.type === 'hypothesis' ? 'Hypothesis' : 'Open-ended'}</span>
    <StatusBadge status={data.idea.status} />
  </div>
  <h1 class="text-2xl font-bold" style="color:var(--ink)">{data.idea.title}</h1>
  {#if data.author}<p class="text-sm" style="color:var(--faint)">by <a href="/u/{data.author.handle}" style="color:var(--green-deep)">{data.author.display_name ?? data.author.handle}</a></p>{/if}
  {#if data.idea.claim}<p class="mt-3 italic" style="color:var(--body)">{data.idea.claim}</p>{/if}
  {#if data.idea.summary_md}<p class="mt-3 whitespace-pre-wrap" style="color:var(--body)">{data.idea.summary_md}</p>{/if}
  {#if data.categories.length}<div class="mt-4 flex flex-wrap gap-2">{#each data.categories as c}<span class="rounded-full px-2 py-0.5 text-xs" style="border:1px solid var(--line); color:var(--muted)">{c.title}</span>{/each}</div>{/if}
  {#if data.idea.source_url}<p class="mt-4 text-sm"><a href={data.idea.source_url} target="_blank" rel="noopener" style="color:var(--green-deep)">Source ↗</a></p>{/if}
</article>

<section class="mt-8">
  <div class="mb-3 flex items-center justify-between">
    <h2 class="text-xl font-bold" style="color:var(--ink)">Answers</h2>
    {#if data.canSubmit}
      <a href="/ideas/{data.idea.id}/answer" class="rounded-xl px-4 py-2 text-sm font-medium" style="background:var(--ink); color:#fff">Submit an answer</a>
    {/if}
  </div>
  {#if data.answers.length === 0}
    <p style="color:var(--muted)">No answers yet.</p>
  {:else}
    <div class="flex flex-col gap-3">
      {#each data.answers as answer (answer.id)}
        <AnswerCard {answer} />
      {/each}
    </div>
  {/if}
</section>
```

- [ ] **Step 3: Verify** `npm run check` + `npm run build`.

- [ ] **Step 4: Commit** `git add src/routes/ideas && git commit -m "feat: idea detail shows answers (RLS-scoped) + submit CTA"`

---

## Task 7: Expert console — review queue + verify / request-revision / reject

**Files:** `src/routes/console/+page.server.ts` (modify), `src/routes/console/+page.svelte` (modify)

- [ ] **Step 1: Replace `+page.server.ts`** (keeps the Plan 2 create-idea action; adds the review queue + transition actions)

```ts
import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

async function requireExpert(supabase: any, userId: string | undefined) {
  if (!userId) return false;
  const { data } = await supabase.from('experts').select('status').eq('id', userId).single();
  return data?.status === 'approved';
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) redirect(303, '/login?next=/console');
  if (!(await requireExpert(supabase, user.id))) error(403, 'Approved experts only');

  const { data: ideas } = await supabase
    .from('ideas').select('id, title, type, status').eq('author_id', user.id)
    .order('created_at', { ascending: false });

  // answers awaiting a decision on MY ideas (ideas!inner — exactly one FK to ideas, so no hint needed; the
  // submitter embed names its constraint because answers has four FKs to profiles)
  const { data: rawQueue } = await supabase
    .from('answers')
    .select(
      'id, title, explanation_md, status, payout_amount_cents, idea_id,' +
        ' ideas!inner(id, title, type, author_id),' +
        ' submitter:profiles!answers_submitter_id_fkey(handle, display_name),' +
        ' answer_artifacts(id, kind, url, label)'
    )
    .eq('ideas.author_id', user.id)
    .in('status', ['submitted', 'under_review', 'revision_requested'])
    .order('created_at', { ascending: true });

  // Normalise the to-one `submitter`/`ideas` embeds (supabase-js may return them as arrays); `(q: any)` matches
  // the Plan-2 embed precedent and keeps `npm run check` at 0 errors.
  const queue = (rawQueue ?? []).map((q: any) => ({
    ...q,
    submitter: Array.isArray(q.submitter) ? (q.submitter[0] ?? null) : q.submitter,
    ideas: Array.isArray(q.ideas) ? (q.ideas[0] ?? null) : q.ideas
  }));

  return { ideas: ideas ?? [], queue };
};

export const actions: Actions = {
  create: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireExpert(supabase, user.id))) return fail(403, { message: 'Approved experts only' });
    const fd = await request.formData();
    const title = String(fd.get('title') ?? '').trim();
    if (!title) return fail(400, { message: 'Title required' });
    const type = fd.get('type') === 'hypothesis' ? 'hypothesis' : 'open_ended';
    const { data, error: e } = await supabase.from('ideas').insert({
      author_id: user.id, title, type,
      summary_md: String(fd.get('summary_md') ?? ''),
      claim: type === 'hypothesis' ? String(fd.get('claim') ?? '') : null,
      status: 'open', published_at: new Date().toISOString()
    }).select('id').single();
    if (e) return fail(400, { message: e.message });
    redirect(303, `/ideas/${data!.id}`);
  },

  start_review: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireExpert(supabase, user.id))) return fail(403, { message: 'Approved experts only' });
    const fd = await request.formData();
    const { error: e } = await supabase.rpc('start_review', { p_answer_id: String(fd.get('answer_id')) });
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  },

  verify: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireExpert(supabase, user.id))) return fail(403, { message: 'Approved experts only' });
    const fd = await request.formData();
    const dollars = Number(fd.get('payout') ?? '');
    const payout = Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : null;
    const resolutionRaw = String(fd.get('resolution') ?? '');
    const resolution = ['yes', 'no', 'ambiguous'].includes(resolutionRaw) ? resolutionRaw : null;
    const { error: e } = await supabase.rpc('verify_answer', {
      p_answer_id: String(fd.get('answer_id')),
      p_note: String(fd.get('note') ?? '') || null,
      p_payout_amount_cents: payout,
      p_resolution: resolution
    });
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  },

  request_revision: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireExpert(supabase, user.id))) return fail(403, { message: 'Approved experts only' });
    const fd = await request.formData();
    const { error: e } = await supabase.rpc('request_revision_answer', {
      p_answer_id: String(fd.get('answer_id')), p_note: String(fd.get('note') ?? '') || null
    });
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  },

  reject: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireExpert(supabase, user.id))) return fail(403, { message: 'Approved experts only' });
    const fd = await request.formData();
    const { error: e } = await supabase.rpc('reject_answer', {
      p_answer_id: String(fd.get('answer_id')), p_note: String(fd.get('note') ?? '') || null
    });
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  }
};
```

> **Note:** every action handler re-checks `requireExpert()` as defense-in-depth, but the **RPC is the real authority** — it independently re-checks `experts.status='approved'`, so a revoked expert is blocked even if they bypass the UI. The verify form sends `payout` (dollars → cents) and, for hypothesis ideas, a required `resolution`; the RPC rejects a missing/zero payout or a missing hypothesis resolution.

- [ ] **Step 2: Replace `+page.svelte`** (keeps the Plan 2 post-idea form + list; adds the review queue)

```svelte
<script lang="ts">
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import Money from '$lib/components/Money.svelte';
  let { data, form } = $props();
</script>
<h1 class="mb-4 text-2xl font-bold" style="color:var(--ink)">Expert console</h1>
{#if form?.message}<p class="mb-3" style="color:var(--neg)">{form.message}</p>{/if}

<form method="POST" action="?/create" class="mb-8 flex flex-col gap-2 rounded-2xl border p-5"
      style="border-color:var(--line); background:var(--surface)">
  <h2 class="font-bold" style="color:var(--ink)">Post a new idea</h2>
  <input name="title" placeholder="Title" required class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
  <select name="type" class="rounded-xl border px-3 py-2" style="border-color:var(--line)">
    <option value="open_ended">Open-ended</option>
    <option value="hypothesis">Hypothesis (yes/no)</option>
  </select>
  <input name="claim" placeholder="Hypothesis claim (if hypothesis)" class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
  <textarea name="summary_md" placeholder="Summary (markdown)" class="rounded-xl border px-3 py-2" style="border-color:var(--line)"></textarea>
  <button class="self-start rounded-xl px-4 py-2 font-medium" style="background:var(--ink); color:#fff">Publish</button>
</form>

<h2 class="mb-2 font-bold" style="color:var(--ink)">Review queue</h2>
{#if data.queue.length === 0}
  <p class="mb-8" style="color:var(--muted)">No answers awaiting review.</p>
{:else}
  <div class="mb-8 flex flex-col gap-3">
    {#each data.queue as a (a.id)}
      <div class="rounded-2xl border p-5" style="border-color:var(--line); background:var(--surface)">
        <div class="mb-1 flex items-center justify-between gap-2">
          <div>
            <a href="/ideas/{a.idea_id}" class="font-bold" style="color:var(--ink)">{a.title}</a>
            <span class="ml-2 text-xs" style="color:var(--faint)">on “{a.ideas?.title}” · by {a.submitter?.display_name ?? a.submitter?.handle}</span>
          </div>
          <StatusBadge status={a.status} />
        </div>
        {#if a.explanation_md}<p class="mb-2 whitespace-pre-wrap text-sm" style="color:var(--body)">{a.explanation_md}</p>{/if}
        {#if a.answer_artifacts?.length}
          <ul class="mb-3 flex flex-col gap-1 text-sm">
            {#each a.answer_artifacts as art (art.id)}
              <li><a href={art.url} target="_blank" rel="noopener" style="color:var(--green-deep)">{art.label ?? art.kind} ↗</a></li>
            {/each}
          </ul>
        {/if}

        <form method="POST" action="?/verify" class="flex flex-wrap items-end gap-2 border-t pt-3" style="border-color:var(--line)">
          <input type="hidden" name="answer_id" value={a.id} />
          <label class="text-xs" style="color:var(--faint)">Intended payout ($)
            <input name="payout" type="number" min="0.01" step="0.01" placeholder="0.00" required
                   class="block w-28 rounded-xl border px-2 py-1" style="border-color:var(--line)" />
          </label>
          {#if a.ideas?.type === 'hypothesis'}
            <label class="text-xs" style="color:var(--faint)">Resolution
              <select name="resolution" class="block rounded-xl border px-2 py-1" style="border-color:var(--line)">
                <option value="yes">Yes</option><option value="no">No</option><option value="ambiguous">Ambiguous</option>
              </select>
            </label>
          {/if}
          <input name="note" placeholder="Note (optional)" class="flex-1 rounded-xl border px-2 py-1" style="border-color:var(--line)" />
          <button class="rounded-xl px-3 py-1 text-sm font-medium" style="background:var(--ink); color:#fff">Verify</button>
        </form>

        <div class="mt-2 flex gap-4">
          <form method="POST" action="?/request_revision" class="flex flex-1 gap-2">
            <input type="hidden" name="answer_id" value={a.id} />
            <input name="note" placeholder="What to revise" class="flex-1 rounded-xl border px-2 py-1 text-sm" style="border-color:var(--line)" />
            <button class="text-sm" style="color:var(--warn)">Request revision</button>
          </form>
          <form method="POST" action="?/reject">
            <input type="hidden" name="answer_id" value={a.id} />
            <button class="text-sm" style="color:var(--neg)">Reject</button>
          </form>
        </div>
      </div>
    {/each}
  </div>
{/if}

<h2 class="mb-2 font-bold" style="color:var(--ink)">Your ideas</h2>
{#if data.ideas.length === 0}<p style="color:var(--muted)">No ideas yet.</p>{:else}
  <ul class="flex flex-col gap-2">
    {#each data.ideas as i (i.id)}<li><a href="/ideas/{i.id}" style="color:var(--green-deep)">{i.title}</a> <span style="color:var(--faint)">· {i.status}</span></li>{/each}
  </ul>
{/if}
```

- [ ] **Step 3: Verify** `npm run check` (0 errors) + `npm run build` (clean).

- [ ] **Step 4: Commit** `git add src/routes/console && git commit -m "feat: expert console review queue — verify/request-revision/reject via RPC"`

---

## Task 8: Admin charitable-purpose gate — `/admin/payouts`

**Files:** `src/routes/admin/payouts/+page.server.ts`, `src/routes/admin/payouts/+page.svelte`

- [ ] **Step 1: `+page.server.ts`**

```ts
import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

async function requireAdmin(supabase: any, userId: string | undefined) {
  if (!userId) return false;
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', userId).single();
  return data?.is_admin === true;
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) redirect(303, '/login?next=/admin/payouts');
  if (!(await requireAdmin(supabase, user.id))) error(403, 'Admins only');

  const { data: rawPending } = await supabase
    .from('answers')
    .select(
      'id, title, payout_amount_cents, payout_currency, verified_at, idea_id,' +
        ' ideas(id, title),' +
        ' submitter:profiles!answers_submitter_id_fkey(handle, display_name)'
    )
    .eq('status', 'verified')
    .is('admin_approved_at', null)
    .is('admin_rejected_at', null)
    .order('verified_at', { ascending: true });

  // Normalise the to-one `submitter`/`ideas` embeds; `(p: any)` matches the Plan-2 embed precedent.
  const pending = (rawPending ?? []).map((p: any) => ({
    ...p,
    submitter: Array.isArray(p.submitter) ? (p.submitter[0] ?? null) : p.submitter,
    ideas: Array.isArray(p.ideas) ? (p.ideas[0] ?? null) : p.ideas
  }));

  return { pending };
};

export const actions: Actions = {
  approve: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireAdmin(supabase, user.id))) return fail(403, { message: 'Admins only' });
    const fd = await request.formData();
    const { error: e } = await supabase.rpc('admin_approve_payout', {
      p_answer_id: String(fd.get('answer_id')), p_note: String(fd.get('note') ?? '') || null
    });
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  },
  reject: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user || !(await requireAdmin(supabase, user.id))) return fail(403, { message: 'Admins only' });
    const fd = await request.formData();
    const { error: e } = await supabase.rpc('admin_reject_payout', {
      p_answer_id: String(fd.get('answer_id')), p_note: String(fd.get('note') ?? '') || null
    });
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  }
};
```

- [ ] **Step 2: `+page.svelte`**

```svelte
<script lang="ts">
  import Money from '$lib/components/Money.svelte';
  let { data, form } = $props();
</script>
<h1 class="mb-1 text-2xl font-bold" style="color:var(--ink)">Charitable-purpose gate</h1>
<p class="mb-4 text-sm" style="color:var(--muted)">Verified answers awaiting admin approval. Approving records the intended payout (no funds move in Phase 1).</p>
{#if form?.message}<p class="mb-3" style="color:var(--neg)">{form.message}</p>{/if}

{#if data.pending.length === 0}
  <p style="color:var(--muted)">Nothing awaiting approval.</p>
{:else}
  <table class="w-full text-sm">
    <thead><tr style="color:var(--faint)">
      <th class="text-left">Answer</th><th class="text-left">Idea</th><th class="text-left">Submitter</th>
      <th class="text-right">Intended</th><th></th>
    </tr></thead>
    <tbody>
      {#each data.pending as a (a.id)}
        <tr style="border-top:1px solid var(--line)">
          <td class="py-2" style="color:var(--ink)"><a href="/ideas/{a.idea_id}" style="color:var(--green-deep)">{a.title}</a></td>
          <td style="color:var(--muted)">{a.ideas?.title}</td>
          <td style="color:var(--muted)">{a.submitter?.display_name ?? a.submitter?.handle}</td>
          <td class="text-right" style="color:var(--ink)"><Money cents={a.payout_amount_cents} currency={a.payout_currency} /></td>
          <td class="py-2 text-right">
            <form method="POST" action="?/approve" class="inline">
              <input type="hidden" name="answer_id" value={a.id} />
              <button class="mr-3" style="color:var(--green-deep)">Approve</button>
            </form>
            <form method="POST" action="?/reject" class="inline">
              <input type="hidden" name="answer_id" value={a.id} />
              <button style="color:var(--neg)">Reject</button>
            </form>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
```

- [ ] **Step 3: Verify** `npm run check` + `npm run build`.

- [ ] **Step 4: Commit** `git add src/routes/admin && git commit -m "feat: admin charitable-purpose gate (approve/reject verified answers)"`

---

## Task 9: Tests — unit + E2E + full suite

**Files:** `src/lib/artifacts.test.ts`, `e2e/answers.spec.ts`

- [ ] **Step 1: Unit test `src/lib/artifacts.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { inferKind } from './artifacts';

describe('inferKind', () => {
  it('detects github', () => expect(inferKind('https://github.com/org/repo')).toBe('github'));
  it('detects colab', () => expect(inferKind('https://colab.research.google.com/drive/abc')).toBe('colab'));
  it('detects pdf', () => expect(inferKind('https://example.com/paper.pdf')).toBe('pdf'));
  it('defaults http to url', () => expect(inferKind('https://example.com/x')).toBe('url'));
  it('non-url => other', () => expect(inferKind('mailto:me@x.com')).toBe('other'));
});
```

- [ ] **Step 2: E2E `e2e/answers.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

// NOTE: these assert the unauthenticated auth-gate redirect only (the submit loader redirects on !user BEFORE
// it looks up the idea, so the random UUID is irrelevant). The authenticated submit→verify→admin-gate happy
// path is proven by the pgTAP RLS/RPC suite (Task 3); a full authed browser E2E is deferred to Plan 5 polish.
test('submit-answer route requires auth (redirects to login)', async ({ page }) => {
  await page.goto('/ideas/00000000-0000-0000-0000-000000000000/answer');
  await expect(page).toHaveURL(/\/login/);
});

test('admin payouts requires auth (redirects to login)', async ({ page }) => {
  await page.goto('/admin/payouts');
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step 3: Run the full suite**

Run, in order:
- `npm run check` → 0 errors
- `npx vitest run` → all pass (existing + `inferKind`)
- `supabase test db` → all pgTAP pass (Plan 1 + 2 + the 43 new Plan-3 assertions)
- `npm run build` → clean
- `npx playwright test` → all pass (free the port first if needed)

- [ ] **Step 4: Commit** `git add . && git commit -m "test: artifacts inferKind unit + answers E2E"`

---

## Done-when (Plan 3 acceptance)

- `answers` / `answer_artifacts` / `answer_reviews` exist with RLS; the **43-assertion** pgTAP suite proves: members submit only their own answers to open ideas (status + `legacy_id` pinned); non-involved users can't read non-verified answers **or their artifacts**; verified answers are public; **no direct client UPDATE** on `answers`; start-review/verify/request-revision/reject/resubmit/admin-approve/admin-reject work **only** for the right actor; a **revoked expert cannot verify** (RPC re-checks `experts.status`); hypothesis verify resolves the idea and **auto-rejects the losers**; an already-resolved idea blocks new submissions and further verifies; the admin gate **cannot be decided twice**; the audit table is **deny-by-default** (client INSERT denied) and is written by the RPCs.
- A member can submit an answer (title + explanation + artifact links) to an open idea; the idea page shows verified answers publicly and the submitter's own answer privately.
- An approved expert sees a review queue for their ideas and can verify (recording a **required positive** intended payout, + a **required** resolution for hypotheses), request revision, or reject — each writing an `answer_reviews` audit row.
- An admin sees the charitable-purpose gate queue and can approve/reject verified answers. **No funds move (money OFF).**
- Single-winner and gate-decision invariants are **lock-enforced** (`FOR UPDATE`), so they hold under concurrency — the seam Phase 2 hangs real money on is correct now.
- Schema carries `legacy_id` + `legacy jsonb` so the later ETL of old `results` is lossless (`answer_reviews` imports zero legacy rows).
- All suites green; no secrets; no `@html` of user content; advisors show no new findings (the informational `answer_reviews` RLS-no-write-policy note is expected). The authed browser E2E (submit→verify→gate) is intentionally deferred to Plan 5; the flow is proven by pgTAP.

**After merge:** controller applies both Plan-3 migrations to cloud `gjomchhbsbtauzkpyjwa` via MCP, re-runs advisors, then authors **Plan 4 (Funding pledges & Dashboards — add the chart tokens here)**.
```