# AI Safety Ideas — Phase 1 · Plan 4: Funding pledges & Dashboards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add the **funding** layer — `idea_funding` (pledges) + a `bounty_pot` view — the **funder dashboard** (`/dashboard`: followed-expert feed · discover/follow · my funding), the **BountyMeter** on idea pages, and the first **data-viz** surface using the `CLAUDE.md` chart tokens. **Money stays OFF**: a pledge is a *visible Phase-1 commitment* (`status='committed'`), not a money movement; escrow/release/refund are Phase-2 RPCs.

**Architecture:** Builds on Plans 1–3 (identity/`follows`, `ideas`, `answers`). Pledge creation is a plain RLS INSERT (funder pledges to an open idea, `status` + `legacy` pinned), mirroring how answer-submission works — no money RPC in Phase 1. The pot is a `security_invoker` SQL **view** over active pledges (no mutable column on `ideas`). The dashboard reuses Plan 1's `follows` table (RLS already allows self-manage) for the feed/discover. Charts are dependency-free inline SVG using the brand chart tokens.

**Tech Stack:** unchanged from Plans 1–3 (SvelteKit 2 + Svelte 5 runes + Supabase v2 + `@supabase/ssr`, pgTAP, Playwright, Vitest, Tailwind v4).

**Cloud note (controller-handled, NOT a subagent task):** subagents develop + test against the **local** stack only. After the migration is finalized and reviewed, the controller applies it to cloud `gjomchhbsbtauzkpyjwa` via the Supabase MCP and re-runs `get_advisors`. Subagents must NOT touch the cloud, `CLAUDE.md`, `docs/`, `.claude/`, or `src_legacy_v0/`.

---

## Key design decisions

- **Pledges are Phase-1 commitments, money OFF.** `idea_funding.status='committed'` records "this funder pledges $X to this idea." No funds move; `escrowed`/`released`/`refunded` are reserved for the Phase-2 money plan (which adds the ledger + SECURITY DEFINER escrow RPCs that transition a pledge). Plan 4 adds **no** UPDATE policy and **no** money RPC.
- **Pledge creation is a plain RLS INSERT** (not an RPC) — same posture as answer submission: `WITH CHECK` pins `funder_id = auth.uid()`, `status='committed'`, `currency='USD'`, `amount_cents > 0`, `legacy_id IS NULL`/`legacy='{}'` (service-role-only ETL anchors), and requires the idea to be `open`.
- **Pledges follow their idea's visibility** (hardened after plan review). The SELECT policy reads a pledge only if the caller can see its idea (`exists (select 1 from public.ideas i where i.id = idea_id)` — leverages the `ideas` RLS that hides drafts) **or** the caller is the funder. So reverting an idea to `draft` hides its pledges + pot too (no money-leak on un-publish); for non-draft ideas this is the Manifund-style public display. Because `bounty_pot` is `security_invoker`, this same gate automatically excludes hidden-idea pledges from the pot. (A funder-anonymity flag is deferred.)
- **Top-ups allowed:** a funder may pledge multiple times to the same idea (spec §3 "funders can top up"); no unique `(idea, funder)` constraint. The idea-page funder list **aggregates by funder** (sums a funder's pledges into one row) so it agrees with `funder_count`.
- **Anti-vandalism:** the INSERT WITH CHECK caps a single pledge at **`amount_cents <= 100000000`** ($1M) so a malicious member can't deface a public pot with an absurd figure. (Per-endpoint **rate-limiting** — spec §9 — is a cross-cutting concern applying to submit/pledge/etc.; it's deferred to a single app-wide pass, noted in Plan 5, not bolted onto this one RLS policy.)
- **Withdraw = delete own `committed` pledge** (DELETE policy, `committed`-only). The action `.select()`s the deleted row and fails loudly if RLS matched nothing (no false "withdrawn"). Once Phase 2 escrows a pledge it's no longer `committed`, so it can't be silently withdrawn.
- **`bounty_pot` is a `security_invoker` view** — `sum(amount) filter (committed|escrowed)` (COALESCE→0) + **`count(distinct coalesce(funder_id::text,'anon'))`** per idea (spec's "no mutable column" rule). The `coalesce(...,'anon')` is deliberate: plain `count(distinct funder_id)` drops deleted (`null`) funders and desyncs from `pot_cents`; bucketing nulls as `'anon'` keeps the count consistent with the money the pot shows. `security_invoker=true` (PG15+) so it respects `idea_funding` RLS; explicit `grant select ... to anon, authenticated`.
- **Post-login honors `?next=`** (fixed here). The dashboard gate redirects to `/login?next=/dashboard`; this plan threads `next` through the login actions → `/auth/callback?next=…` (already sanitized) so sign-in returns the user to where they were headed — fixing every gated route (`/console`, `/admin`, `/ideas/[id]/answer`, `/dashboard`), not just this one.
- **Dashboard shows a "total committed" aggregate** (§8 "balance", money OFF) above the chart — the funder's Phase-1 advisory total, labelled "no funds moved yet".
- **`follows.expert_id` references `profiles`, not `experts`** (Plan-1 schema): a user can technically follow any profile, but only approved experts can author ideas, so only expert-authored bounties ever surface in the feed — harmless, left as-is.
- **No funding goal.** The schema has none (spec: pot is open-ended; hypothesis "winner takes the pot", open-ended "top up"). `BountyMeter` shows the accumulating pot with a green "funded" accent bar (full when pot>0), not a progress-to-goal fill.
- **`funder_id` is `on delete set null`** (a pledge outlives a deleted account; original anchored in `legacy`), mirroring `ideas.author_id` / `answers.submitter_id`.
- **Chart tokens land in `app.css`** now (`--chart-1..2`, `--chart-ink`, `--chart-grid`) per `CLAUDE.md` §data-viz; charts are green-forward on greyscale, dependency-free inline SVG, reduced-motion-safe (the global `prefers-reduced-motion` rule neutralizes the width transition).
- **Dashboard tabs are server-driven** (`?tab=feed|discover`), matching the Plan-2 `/ideas` filter pattern — no client store. Follow/unfollow uses Plan 1's `follows` RLS (`users manage own follows`); no new policy.
- **ETL:** the old `idea_user_funding_relation` rows map into `idea_funding` (amount/funder/idea + `legacy`), anchored by `legacy_id`; imported as `committed` (Phase 1). `legacy_*` is service-role-only.

---

## File structure (Plan 4)

| File | Responsibility |
|---|---|
| `supabase/migrations/<ts>_idea_funding.sql` | `idea_funding` table + RLS + indexes + `bounty_pot` view + grants |
| `supabase/tests/database/idea_funding_test.sql` | pgTAP RLS + view tests |
| `src/app.css` | **Modify**: add the `--chart-*` data-viz tokens |
| `src/lib/types/database.ts` | Regenerated (table + view) |
| `src/lib/funding.ts` | pure `barPercents()` helper (unit-tested) |
| `src/lib/components/BountyMeter.svelte`, `BarChart.svelte` | New presentation components |
| `src/routes/ideas/[id]/+page.server.ts` / `+page.svelte` | **Modify**: load pot + funders, render BountyMeter, `pledge` action + form |
| `src/routes/login/+page.server.ts` / `+page.svelte` | **Modify**: thread `?next=` through sign-in (so gated routes return after login) |
| `src/routes/dashboard/+page.server.ts` / `+page.svelte` | New funder dashboard (feed · discover/follow · my funding + chart) |
| `src/lib/funding.test.ts`, `e2e/funding.spec.ts` | Unit + E2E |

---

## Task 1: Migration — idea_funding + RLS + bounty_pot view

**Files:** `supabase/migrations/<ts>_idea_funding.sql`

- [ ] **Step 1: Create the migration**

`supabase migration new idea_funding`, contents:

```sql
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
-- is the funder. So un-publishing an idea (revert to draft) hides its pledges + pot too — no money-leak.
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

-- NOTE: NO update policy — committed -> escrowed -> released/refunded are Phase-2 SECURITY DEFINER money RPCs.

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
```

- [ ] **Step 2: Apply locally**

Run: `supabase db reset` (a FULL rebuild — **not** `supabase migration up`. The local DB may hold orphaned `idea_funding`/`bounty_pot` objects from a prior session; a full reset rebuilds from migrations only and clears them. `migration up` onto a dirty DB would fail with "relation already exists".)
Expected: all migrations (Plans 1–4) apply with no errors.

- [ ] **Step 3: Smoke-check**

Run: `docker exec supabase_db_aisafetyideas psql -U postgres -d postgres -c "\dt public.idea_funding"` and `... -c "\dv public.bounty_pot"`
Expected: the table and the view exist.
Run: `docker exec supabase_db_aisafetyideas psql -U postgres -d postgres -c "select count(*) from pg_policies where schemaname='public' and tablename='idea_funding';"`
Expected: `3` (1 select + 1 insert + 1 delete).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): idea_funding pledges + RLS + bounty_pot view (Plan 4)"
```

---

## Task 2: pgTAP — idea_funding RLS + bounty_pot view

**Files:** `supabase/tests/database/idea_funding_test.sql`

- [ ] **Step 1: Write the test**

```sql
begin;
select plan(21);

-- seed users (handle_new_user trigger creates profiles)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','alice@example.com','x', now(), now(), now()),  -- expert/author
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','bob@example.com','x', now(), now(), now()),    -- funder
  ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333','authenticated','authenticated','carol@example.com','x', now(), now(), now()),  -- funder
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','dave@example.com','x', now(), now(), now());   -- other

insert into public.experts (id, status) values ('11111111-1111-1111-1111-111111111111','approved');
insert into public.ideas (id, author_id, type, title, status) values
  ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','open_ended','Open idea','open'),
  ('a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','open_ended','Draft idea','draft');

set local role authenticated;

-- ===== bob (funder): insert pinning =====
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into public.idea_funding (id, idea_id, funder_id, amount_cents)
  values ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',5000);
select ok((select count(*) from public.idea_funding) = 1, '1: member pledges to an open idea');                                            -- 1
select throws_ok($$ insert into public.idea_funding (idea_id, funder_id, amount_cents, status)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',100,'escrowed') $$,
  '42501', null, '2: cannot self-escrow a pledge on insert');                                                                              -- 2
select throws_ok($$ insert into public.idea_funding (idea_id, funder_id, amount_cents)
  values ('a0000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222',100) $$,
  '42501', null, '3: cannot pledge to a draft idea');                                                                                      -- 3
select throws_ok($$ insert into public.idea_funding (idea_id, funder_id, amount_cents)
  values ('a0000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333',100) $$,
  '42501', null, '4: cannot pledge on behalf of another funder');                                                                          -- 4
select throws_ok($$ insert into public.idea_funding (idea_id, funder_id, amount_cents, legacy_id)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',100,9) $$,
  '42501', null, '5: cannot set legacy_id on a live pledge');                                                                              -- 5
select throws_ok($$ insert into public.idea_funding (idea_id, funder_id, amount_cents)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',100000001) $$,
  '42501', null, '6: cannot pledge above the $1M cap');                                                                                     -- 6
select throws_ok($$ insert into public.idea_funding (idea_id, funder_id, amount_cents, currency)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',100,'EUR') $$,
  '42501', null, '7: cannot pledge in a non-USD currency (Phase 1)');                                                                       -- 7
insert into public.idea_funding (id, idea_id, funder_id, amount_cents)
  values ('f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',3000);
select ok((select count(*) from public.idea_funding) = 2, '8: a funder may top up (multiple pledges)');                                    -- 8
select is((select pot_cents from public.bounty_pot where idea_id='a0000000-0000-0000-0000-000000000001'),
  8000::bigint, '9: bounty_pot sums the funder''s pledges');                                                                              -- 9
select is((select funder_count from public.bounty_pot where idea_id='a0000000-0000-0000-0000-000000000001'),
  1::bigint, '10: top-ups collapse to one distinct funder');                                                                               -- 10

-- ===== carol (second funder) =====
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
insert into public.idea_funding (id, idea_id, funder_id, amount_cents)
  values ('f0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333',2000);
select ok((select count(*) from public.idea_funding) = 3, '11: second funder pledges');                                                    -- 11
select is((select pot_cents from public.bounty_pot where idea_id='a0000000-0000-0000-0000-000000000001'),
  10000::bigint, '12: pot reflects both funders');                                                                                         -- 12
select is((select funder_count from public.bounty_pot where idea_id='a0000000-0000-0000-0000-000000000001'),
  2::bigint, '13: funder_count is distinct funders');                                                                                      -- 13

-- ===== anon: can read public (visible-idea) pledges; cannot insert =====
set local role anon;
select ok((select count(*) from public.idea_funding) = 3, '14: pledges to a visible idea are publicly readable');                          -- 14
select throws_ok($$ insert into public.idea_funding (idea_id, funder_id, amount_cents)
  values ('a0000000-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444',100) $$,
  '42501', null, '15: anon cannot insert a pledge');                                                                                        -- 15

-- ===== seed mixed-status + null-funder + draft pledges as the table owner (bypasses RLS) =====
reset role;
insert into public.idea_funding (id, idea_id, funder_id, amount_cents, status) values
  ('f0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444',5000,'refunded'),
  ('f0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444',7000,'released'),
  ('f0000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444',1500,'escrowed'),
  ('f0000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000002','44444444-4444-4444-4444-444444444444',4000,'committed'),  -- on the DRAFT idea
  ('f0000000-0000-0000-0000-000000000008','a0000000-0000-0000-0000-000000000001', null               ,600 ,'committed');  -- deleted-account funder
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
-- pot includes committed(8000+2000)+escrowed(1500)+null-committed(600)=12100; refunded(5000)+released(7000) excluded
select is((select pot_cents from public.bounty_pot where idea_id='a0000000-0000-0000-0000-000000000001'),
  12100::bigint, '16: pot includes committed+escrowed, excludes refunded+released');                                                       -- 16
-- distinct funders: bob, carol, dave (escrowed), and the null-funder 'anon' bucket = 4
select is((select funder_count from public.bounty_pot where idea_id='a0000000-0000-0000-0000-000000000001'),
  4::bigint, '17: funder_count buckets null funders as anon (survives account deletion)');                                                 -- 17

-- ===== a pledge to a hidden (draft) idea is NOT publicly readable =====
set local role anon;
select is((select count(*) from public.idea_funding where idea_id='a0000000-0000-0000-0000-000000000002'),
  0::bigint, '18: pledges to a draft idea are not leaked to the public');                                                                   -- 18

-- ===== no UPDATE path for clients =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
update public.idea_funding set amount_cents = 999999 where id='f0000000-0000-0000-0000-000000000001';
select is((select amount_cents from public.idea_funding where id='f0000000-0000-0000-0000-000000000001'),
  5000::bigint, '19: no direct client UPDATE on idea_funding');                                                                            -- 19

-- ===== withdraw own committed pledge =====
delete from public.idea_funding where id='f0000000-0000-0000-0000-000000000001';
select ok((select count(*) from public.idea_funding where id='f0000000-0000-0000-0000-000000000001') = 0,
  '20: funder withdraws own committed pledge');                                                                                            -- 20

-- ===== cannot withdraw another funder's pledge =====
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
delete from public.idea_funding where id='f0000000-0000-0000-0000-000000000002';
select is((select count(*) from public.idea_funding where id='f0000000-0000-0000-0000-000000000002'),
  1::bigint, '21: cannot withdraw another funder''s pledge');                                                                              -- 21

select * from finish();
rollback;
```

- [ ] **Step 2: Run**

Run: `supabase test db`
Expected: **21/21** pass (this file) + the existing Plan 1–3 suites all pass. Do NOT weaken RLS to pass. If you add/remove an assertion, set `plan(N)` to match (`grep -cE 'select (ok|is|throws_ok|lives_ok)\(' idea_funding_test.sql` must equal N).

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/database/idea_funding_test.sql
git commit -m "test(db): pgTAP RLS + bounty_pot view tests for idea_funding"
```

---

## Task 3: Chart tokens + types + funding helper + components

**Files:** `src/app.css` (modify), `src/lib/types/database.ts`, `src/lib/funding.ts`, `src/lib/components/BountyMeter.svelte`, `src/lib/components/BarChart.svelte`

- [ ] **Step 1: Add the data-viz tokens to `src/app.css`** — insert into the `:root` block, right after the Semantic line (`--pos:...; --info:...;`):

```css
  /* Data-viz (green-forward on greyscale, per CLAUDE.md) */
  --chart-1:#44ff98; --chart-2:#1cdb72; --chart-ink:#c7ccc9; --chart-grid:var(--line);
```

- [ ] **Step 2: Regenerate types**

Run: `supabase gen types typescript --local 2>/dev/null > src/lib/types/database.ts`
Confirm `idea_funding` appears under `Tables` and `bounty_pot` under `Views`.

- [ ] **Step 3: `src/lib/funding.ts`** (pure, unit-tested)

```ts
/** Normalise a series of values to integer bar widths (0–100% of the max). Empty/all-zero → all 0. */
export function barPercents(values: number[]): number[] {
  const max = values.length ? Math.max(0, ...values) : 0;
  if (max <= 0) return values.map(() => 0);
  return values.map((v) => Math.max(0, Math.round((v / max) * 100)));
}
```

- [ ] **Step 4: `src/lib/components/BountyMeter.svelte`**

```svelte
<script lang="ts">
  import Money from './Money.svelte';
  let { potCents, funderCount, currency = 'USD' }:
    { potCents: number; funderCount: number; currency?: string } = $props();
  const funded = $derived(potCents > 0);
</script>
<div class="rounded-2xl border p-4" style="border-color:var(--line); background:var(--surface-2)">
  <div class="flex items-baseline justify-between">
    <span class="text-xs uppercase tracking-wide" style="color:var(--faint)">Bounty pot</span>
    <span class="text-xs" style="color:var(--muted)">{funderCount} {funderCount === 1 ? 'funder' : 'funders'}</span>
  </div>
  <div class="mt-1 text-2xl font-bold" style="color:var(--ink)"><Money cents={potCents} {currency} /></div>
  <div class="mt-3 h-2 overflow-hidden rounded-full" style="background:var(--surface)">
    <div class="h-2 rounded-full"
         style="width:{funded ? 100 : 0}%; background:var(--green); transition:width var(--dur-slow) var(--ease-out-soft)"></div>
  </div>
</div>
```

- [ ] **Step 5: `src/lib/components/BarChart.svelte`** (dependency-free, greyscale + `--chart-1`)

```svelte
<script lang="ts">
  import { barPercents } from '$lib/funding';
  let { series, format }:
    { series: { label: string; value: number }[]; format?: (v: number) => string } = $props();
  const pcts = $derived(barPercents(series.map((s) => s.value)));
  const fmt = (v: number) => (format ? format(v) : String(v));
</script>
{#if series.length === 0}
  <p style="color:var(--muted)">No data yet.</p>
{:else}
  <div class="flex flex-col gap-2">
    {#each series as s, i (s.label + i)}
      <div class="flex items-center gap-3 text-sm">
        <span class="w-32 shrink-0 truncate" style="color:var(--muted)" title={s.label}>{s.label}</span>
        <div class="h-3 flex-1 overflow-hidden rounded-full" style="background:var(--surface-2)">
          <div class="h-3 rounded-full"
               style="width:{pcts[i]}%; background:var(--chart-1); transition:width var(--dur-slow) var(--ease-out-soft)"></div>
        </div>
        <span class="w-20 shrink-0 text-right tabular-nums" style="color:var(--ink)">{fmt(s.value)}</span>
      </div>
    {/each}
  </div>
{/if}
```

- [ ] **Step 6: Verify** `npm run check` (0 errors) and `npm run build` (clean).

- [ ] **Step 7: Commit**

```bash
git add src/app.css src/lib
git commit -m "feat: chart tokens + regenerate types + funding helper + BountyMeter/BarChart"
```

---

## Task 4: Idea detail — BountyMeter + pledge

**Files:** `src/routes/ideas/[id]/+page.server.ts` (modify), `src/routes/ideas/[id]/+page.svelte` (modify)

- [ ] **Step 1: Replace `+page.server.ts`** (extends the Plan-3 version with the pot, funder list, `canFund`, and a `pledge` action)

```ts
import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  const { data: idea } = await supabase
    .from('ideas')
    .select('id, title, summary_md, claim, type, status, resolution, estimated_hours, importance, source_url, author_id, currency')
    .eq('id', params.id)
    .single();
  if (!idea) error(404, 'Idea not found');

  const { data: author } = idea.author_id
    ? await supabase.from('profiles').select('handle, display_name').eq('id', idea.author_id).single()
    : { data: null };

  const { data: cats } = await supabase
    .from('idea_categories').select('categories(slug, title)').eq('idea_id', idea.id);

  const { data: rawAnswers } = await supabase
    .from('answers')
    .select(
      'id, title, explanation_md, status, payout_amount_cents, submitter_id,' +
        ' answer_artifacts(id, kind, url, label),' +
        ' submitter:profiles!answers_submitter_id_fkey(handle, display_name)'
    )
    .eq('idea_id', idea.id)
    .order('created_at', { ascending: true });
  const answers = (rawAnswers ?? []).map((a: any) => ({
    ...a,
    submitter: Array.isArray(a.submitter) ? (a.submitter[0] ?? null) : a.submitter
  }));

  // funding: pot (view) + the active funder list (idea_funding has ONE fk to profiles, so no embed hint needed)
  const { data: pot } = await supabase
    .from('bounty_pot').select('pot_cents, funder_count').eq('idea_id', idea.id).maybeSingle();
  const { data: rawFunders } = await supabase
    .from('idea_funding')
    .select('amount_cents, currency, funder_id, funder:profiles(handle, display_name)')
    .eq('idea_id', idea.id)
    .in('status', ['committed', 'escrowed'])
    .order('created_at', { ascending: false });
  // Aggregate by funder so top-ups collapse to one row (and the list agrees with bounty_pot.funder_count);
  // null funder_id (deleted account) buckets as a single 'anon' row, matching the view's coalesce(...,'anon').
  const funderMap = new Map<string, { key: string; name: string; amount_cents: number; currency: string }>();
  for (const f of (rawFunders ?? []) as any[]) {
    const prof = Array.isArray(f.funder) ? (f.funder[0] ?? null) : f.funder;
    const key = f.funder_id ?? 'anon';
    const cur = funderMap.get(key) ?? {
      key, name: prof?.display_name ?? prof?.handle ?? 'Anonymous', amount_cents: 0, currency: f.currency ?? 'USD'
    };
    cur.amount_cents += f.amount_cents;
    funderMap.set(key, cur);
  }
  const funders = [...funderMap.values()];

  return {
    idea,
    author,
    categories: (cats ?? []).map((c: any) => c.categories),
    answers,
    // bounty_pot is a VIEW → every column is typed `number | null`; coalesce the INNER values (the outer `?? {…}`
    // only covers the no-row case) so BountyMeter's `number` props type-check.
    pot: { pot_cents: pot?.pot_cents ?? 0, funder_count: pot?.funder_count ?? 0 },
    funders,
    canSubmit: !!user && idea.status === 'open',
    canFund: !!user && idea.status === 'open'
  };
};

export const actions: Actions = {
  pledge: async ({ request, params, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in to fund this idea' });
    const fd = await request.formData();
    const dollars = Number(fd.get('amount') ?? '');
    if (!Number.isFinite(dollars) || dollars <= 0) return fail(400, { message: 'Enter an amount greater than 0' });
    // RLS enforces funder = self, status pinned 'committed', and the idea must be open
    const { error: e } = await supabase.from('idea_funding').insert({
      idea_id: params.id, funder_id: user.id, amount_cents: Math.round(dollars * 100), status: 'committed'
    });
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  }
};
```

- [ ] **Step 2: Replace `+page.svelte`** (adds BountyMeter + a pledge form + funder list to the Plan-3 version)

```svelte
<script lang="ts">
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import AnswerCard from '$lib/components/AnswerCard.svelte';
  import BountyMeter from '$lib/components/BountyMeter.svelte';
  import Money from '$lib/components/Money.svelte';
  let { data, form } = $props();
</script>
<div class="grid gap-6 lg:grid-cols-[1fr_280px]">
  <div>
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
          {#each data.answers as answer (answer.id)}<AnswerCard {answer} />{/each}
        </div>
      {/if}
    </section>
  </div>

  <aside class="flex flex-col gap-4">
    <BountyMeter potCents={data.pot.pot_cents} funderCount={data.pot.funder_count} currency={data.idea.currency ?? 'USD'} />

    {#if data.canFund}
      <form method="POST" action="?/pledge" class="rounded-2xl border p-4" style="border-color:var(--line); background:var(--surface)">
        <label class="text-xs uppercase tracking-wide" style="color:var(--faint)">Fund this idea ($)
          <input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required
                 class="mt-1 block w-full rounded-xl border px-3 py-2" style="border-color:var(--line)" />
        </label>
        <button class="mt-3 w-full rounded-xl px-4 py-2 text-sm font-medium" style="background:var(--ink); color:#fff">Pledge</button>
        <p class="mt-2 text-xs" style="color:var(--faint)">A pledge is a commitment — no funds move yet.</p>
        {#if form?.message}<p class="mt-2 text-sm" style="color:var(--neg)">{form.message}</p>{/if}
      </form>
    {/if}

    {#if data.funders.length}
      <div class="rounded-2xl border p-4" style="border-color:var(--line); background:var(--surface)">
        <p class="mb-2 text-xs uppercase tracking-wide" style="color:var(--faint)">Funders</p>
        <ul class="flex flex-col gap-1 text-sm">
          {#each data.funders as f (f.key)}
            <li class="flex justify-between gap-2">
              <span style="color:var(--body)">{f.name}</span>
              <span class="tabular-nums" style="color:var(--ink)"><Money cents={f.amount_cents} currency={f.currency} /></span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </aside>
</div>
```

- [ ] **Step 3: Verify** `npm run check` (0 errors) + `npm run build` (clean).

- [ ] **Step 4: Commit** `git add src/routes/ideas && git commit -m "feat: idea detail funding — BountyMeter, pledge action, funder list"`

---

## Task 5: Funder dashboard `/dashboard` (+ honor `?next=` on login)

**Files:** `src/routes/login/+page.server.ts` (modify), `src/routes/login/+page.svelte` (modify), `src/routes/dashboard/+page.server.ts` (new), `src/routes/dashboard/+page.svelte` (new)

### Part A — make post-login return to the gated page

The dashboard (and `/console`, `/admin`, `/ideas/[id]/answer`) redirect unauthenticated users to `/login?next=<path>`, and `/auth/callback` already sanitizes + honors `next` — but the login actions hard-code `next=/`, so sign-in always dumps the user on `/`. Thread `next` through.

- [ ] **Step A1: Replace `src/routes/login/+page.server.ts`** (add a `load` that exposes a sanitized `next`; read+use it in both actions)

```ts
import { redirect, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// same-origin absolute paths only (block "//evil.com" and full URLs), matching /auth/callback
function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

export const load: PageServerLoad = async ({ url }) => ({ next: safeNext(url.searchParams.get('next')) });

export const actions: Actions = {
  google: async ({ url, locals: { supabase } }) => {
    const next = safeNext(url.searchParams.get('next'));
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${url.origin}/auth/callback?next=${encodeURIComponent(next)}` }
    });
    if (error) return fail(400, { message: error.message });
    redirect(303, data.url);
  },
  magiclink: async ({ request, url, locals: { supabase } }) => {
    const next = safeNext(url.searchParams.get('next'));
    const email = String((await request.formData()).get('email') ?? '');
    if (!email) return fail(400, { message: 'Email required' });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${url.origin}/auth/callback?next=${encodeURIComponent(next)}` }
    });
    if (error) return fail(400, { message: error.message });
    return { sent: true };
  }
};
```

- [ ] **Step A2: Replace `src/routes/login/+page.svelte`** (carry `next` in the form action URLs — a `?`-relative action replaces the query string, so `next` must be embedded in the action, not left on the page URL)

```svelte
<script lang="ts">
  let { data, form } = $props();
  const q = $derived(data.next && data.next !== '/' ? `&next=${encodeURIComponent(data.next)}` : '');
</script>
<section class="mx-auto max-w-sm p-8">
  <h1 class="mb-6 text-2xl font-bold" style="color:var(--ink)">Sign in</h1>
  <form method="POST" action="?/google{q}" class="mb-4">
    <button class="w-full rounded-xl border py-2" style="border-color:var(--line)">Continue with Google</button>
  </form>
  <form method="POST" action="?/magiclink{q}" class="flex flex-col gap-2">
    <input name="email" type="email" required placeholder="you@email.com"
           class="rounded-xl border px-3 py-2" style="border-color:var(--line)" />
    <button class="rounded-xl py-2 font-medium" style="background:var(--ink);color:#fff">Email me a link</button>
  </form>
  {#if form?.sent}<p class="mt-3" style="color:var(--green-deep)">Check your email for the link.</p>{/if}
  {#if form?.message}<p class="mt-3" style="color:var(--neg)">{form.message}</p>{/if}
</section>
```

- [ ] **Step A3: Verify + commit** `npm run check` (0 errors); `git add src/routes/login && git commit -m "fix: thread ?next= through login so gated routes return after sign-in"`

### Part B — the dashboard

- [ ] **Step 1: `+page.server.ts`** — auth-gated; feed (followed experts) · discover/follow · my funding; follow/unfollow/withdraw actions

```ts
import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ url, locals: { supabase, safeGetSession } }) => {
  const { user } = await safeGetSession();
  if (!user) redirect(303, '/login?next=/dashboard');
  const tab = url.searchParams.get('tab') === 'discover' ? 'discover' : 'feed';

  const { data: follows } = await supabase.from('follows').select('expert_id').eq('follower_id', user.id);
  const followedIds = (follows ?? []).map((f) => f.expert_id);

  // feed: open ideas authored by experts the user follows
  let feed: any[] = [];
  if (followedIds.length) {
    const { data } = await supabase
      .from('ideas').select('id, title, summary_md, type, status')
      .in('author_id', followedIds).eq('status', 'open')
      .order('created_at', { ascending: false }).limit(50);
    feed = data ?? [];
  }

  // discover: approved experts (experts has two fks to profiles, so name the constraint) + followed flag
  const { data: rawExperts } = await supabase
    .from('experts').select('id, specialty, featured, profiles!experts_id_fkey(handle, display_name)')
    .eq('status', 'approved').order('featured', { ascending: false });
  const experts = (rawExperts ?? []).map((e: any) => ({
    id: e.id,
    specialty: e.specialty,
    featured: e.featured,
    profile: Array.isArray(e.profiles) ? (e.profiles[0] ?? null) : e.profiles,
    following: followedIds.includes(e.id)
  }));

  // my funding: my pledges joined to their idea (idea_funding has ONE fk to ideas, no hint needed)
  const { data: rawMine } = await supabase
    .from('idea_funding')
    .select('id, amount_cents, currency, status, idea_id, ideas(id, title, status)')
    .eq('funder_id', user.id)
    .order('created_at', { ascending: false });
  const myPledges = (rawMine ?? []).map((p: any) => ({
    ...p,
    idea: Array.isArray(p.ideas) ? (p.ideas[0] ?? null) : p.ideas
  }));

  // chart: total committed/escrowed pledged per funded idea
  const byIdea = new Map<string, { label: string; value: number }>();
  for (const p of myPledges) {
    if (p.status !== 'committed' && p.status !== 'escrowed') continue;
    const key = p.idea_id;
    const label = p.idea?.title ?? 'Unknown idea';
    const cur = byIdea.get(key) ?? { label, value: 0 };
    cur.value += p.amount_cents;
    byIdea.set(key, cur);
  }
  const chart = [...byIdea.values()];
  const totalCommittedCents = chart.reduce((sum, c) => sum + c.value, 0);

  return { tab, hasFollows: followedIds.length > 0, feed, experts, myPledges, chart, totalCommittedCents };
};

export const actions: Actions = {
  follow: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in' });
    const fd = await request.formData();
    const { error: e } = await supabase.from('follows')
      .insert({ follower_id: user.id, expert_id: String(fd.get('expert_id')) });
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  },
  unfollow: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in' });
    const fd = await request.formData();
    const { error: e } = await supabase.from('follows')
      .delete().eq('follower_id', user.id).eq('expert_id', String(fd.get('expert_id')));
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  },
  withdraw: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in' });
    const fd = await request.formData();
    // RLS allows deleting only the caller's own still-committed pledge; .select() surfaces a no-op (someone
    // else's pledge, or an already-escrowed one) as a failure instead of a misleading success.
    const { data: del, error: e } = await supabase.from('idea_funding')
      .delete().eq('id', String(fd.get('pledge_id'))).select('id');
    if (e) return fail(400, { message: e.message });
    if (!del?.length) return fail(409, { message: 'Pledge could not be withdrawn (already escrowed or not yours).' });
    return { ok: true };
  }
};
```

- [ ] **Step 2: `+page.svelte`** — tabs + feed/discover + my funding (with the chart)

```svelte
<script lang="ts">
  import IdeaCard from '$lib/components/IdeaCard.svelte';
  import BarChart from '$lib/components/BarChart.svelte';
  import Money from '$lib/components/Money.svelte';
  let { data, form } = $props();
  const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
</script>
<h1 class="mb-4 text-2xl font-bold" style="color:var(--ink)">Dashboard</h1>
{#if form?.message}<p class="mb-3 text-sm" style="color:var(--neg)">{form.message}</p>{/if}

<nav class="mb-6 flex gap-2 text-sm">
  <a href="/dashboard" style="color:{data.tab === 'feed' ? 'var(--green-deep)' : 'var(--muted)'}">Feed</a>
  <a href="/dashboard?tab=discover" style="color:{data.tab === 'discover' ? 'var(--green-deep)' : 'var(--muted)'}">Discover</a>
</nav>

{#if data.tab === 'discover' || !data.hasFollows}
  {#if !data.hasFollows && data.tab === 'feed'}
    <p class="mb-4" style="color:var(--muted)">Follow experts to build your feed of new bounties.</p>
  {/if}
  <div class="mb-8 grid gap-3 sm:grid-cols-2">
    {#each data.experts as e (e.id)}
      <div class="flex items-center justify-between gap-3 rounded-2xl border p-4" style="border-color:var(--line); background:var(--surface)">
        <div>
          <a href="/u/{e.profile?.handle}" class="font-medium" style="color:var(--ink)">{e.profile?.display_name ?? e.profile?.handle ?? 'Expert'}</a>
          {#if e.specialty}<p class="text-xs" style="color:var(--faint)">{e.specialty}</p>{/if}
        </div>
        <form method="POST" action={e.following ? '?/unfollow' : '?/follow'}>
          <input type="hidden" name="expert_id" value={e.id} />
          <button class="rounded-xl px-3 py-1 text-sm font-medium"
                  style={e.following ? 'border:1px solid var(--line); color:var(--muted)' : 'background:var(--ink); color:#fff'}>
            {e.following ? 'Following' : 'Follow'}
          </button>
        </form>
      </div>
    {/each}
  </div>
{:else}
  <div class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each data.feed as idea (idea.id)}<IdeaCard {idea} />{/each}
  </div>
  {#if data.feed.length === 0}<p class="mb-8" style="color:var(--muted)">No new open bounties from the experts you follow.</p>{/if}
{/if}

<h2 class="mb-3 text-xl font-bold" style="color:var(--ink)">My funding</h2>
{#if data.myPledges.length === 0}
  <p style="color:var(--muted)">You haven't pledged to any ideas yet.</p>
{:else}
  <p class="mb-3 text-sm" style="color:var(--muted)">Total committed <span class="text-base font-bold" style="color:var(--ink)"><Money cents={data.totalCommittedCents} /></span> <span style="color:var(--faint)">· no funds moved yet</span></p>
  <div class="mb-4 rounded-2xl border p-4" style="border-color:var(--line); background:var(--surface)">
    <BarChart series={data.chart} format={money} />
  </div>
  <ul class="flex flex-col gap-2">
    {#each data.myPledges as p (p.id)}
      <li class="flex items-center justify-between gap-3 rounded-xl border p-3" style="border-color:var(--line); background:var(--surface)">
        <a href="/ideas/{p.idea_id}" style="color:var(--green-deep)">{p.idea?.title ?? 'Idea'}</a>
        <span class="flex items-center gap-3">
          <span class="tabular-nums" style="color:var(--ink)"><Money cents={p.amount_cents} currency={p.currency} /></span>
          <span class="text-xs" style="color:var(--faint)">{p.status}</span>
          {#if p.status === 'committed'}
            <form method="POST" action="?/withdraw">
              <input type="hidden" name="pledge_id" value={p.id} />
              <button class="text-xs" style="color:var(--neg)">Withdraw</button>
            </form>
          {/if}
        </span>
      </li>
    {/each}
  </ul>
{/if}
```

- [ ] **Step 3: Verify** `npm run check` (0 errors) + `npm run build` (clean).

- [ ] **Step 4: Commit** `git add src/routes/dashboard && git commit -m "feat: funder dashboard — feed/discover/follow + my funding chart"`

---

## Task 6: Tests — unit + E2E + full suite

**Files:** `src/lib/funding.test.ts`, `e2e/funding.spec.ts`

- [ ] **Step 1: Unit test `src/lib/funding.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { barPercents } from './funding';

describe('barPercents', () => {
  it('scales to the max', () => expect(barPercents([50, 100, 25])).toEqual([50, 100, 25]));
  it('handles a non-100 max', () => expect(barPercents([1, 2, 4])).toEqual([25, 50, 100]));
  it('all-zero → all 0', () => expect(barPercents([0, 0])).toEqual([0, 0]));
  it('empty → empty', () => expect(barPercents([])).toEqual([]));
});
```

- [ ] **Step 2: E2E `e2e/funding.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

// Auth-gate only (the authed funding flow is proven by pgTAP); a full browser flow is deferred to Plan 5.
test('dashboard requires auth (redirects to login)', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('ideas browse still renders', async ({ page }) => {
  await page.goto('/ideas');
  await expect(page.getByRole('heading', { name: 'Ideas' })).toBeVisible();
});
```

- [ ] **Step 3: Run the full suite**, in order:
- `npm run check` → 0 errors
- `npx vitest run` → all pass (existing + `barPercents`)
- `supabase test db` → all pgTAP pass (Plans 1–3 + the 21 new Plan-4 assertions)
- `npm run build` → clean
- `npx playwright test` → all pass (free the port first if needed)

- [ ] **Step 4: Commit** `git add . && git commit -m "test: barPercents unit + funding E2E"` (stage only the two new test files — do NOT `git add .` blindly; `.claude/settings.json` is untracked-but-not-ignored, so add paths explicitly)

---

## Done-when (Plan 4 acceptance)

- `idea_funding` exists with RLS; the **21-assertion** pgTAP suite proves: a member pledges only their own funding to an open idea (`status`/`currency`/`legacy` pinned, amount `> 0` and `<= $1M`); **anon can't insert**; pledges to a **visible** idea are public but pledges to a **draft** idea are **not leaked**; top-ups collapse to one distinct funder; **no direct client UPDATE**; a funder withdraws only their own `committed` pledge and cannot delete another's; `bounty_pot` sums `committed`+`escrowed` (excludes `refunded`+`released`) and its `funder_count` buckets `null` (deleted-account) funders as `anon` so it stays consistent with `pot_cents`.
- An idea page shows the `BountyMeter` (pot + funder count + green accent) and a **per-funder-aggregated** funder list; a signed-in member can pledge to an open idea (visible commitment, **money OFF**).
- `/dashboard` is auth-gated and shows: a feed of open bounties from followed experts (or a follow prompt + discover when none followed), a Discover tab to follow/unfollow approved experts, and a "My funding" section with a **total-committed** figure + the `BarChart` (green-forward, `--chart-1`) + per-pledge list + a withdraw that fails loudly on a no-op.
- Signing in from a gated route **returns the user to that route** (`?next=` threaded through login → callback), fixing `/console`, `/admin`, `/ideas/[id]/answer`, and `/dashboard`.
- Chart tokens (`--chart-1..2`, `--chart-ink`, `--chart-grid`) are in `app.css`; charts are greyscale + green, dependency-free, reduced-motion-safe.
- `legacy_id` + `legacy jsonb` carried so the old `idea_user_funding_relation` ETL is lossless.
- All suites green; no secrets; no `@html` of user content; advisors show no new findings (the public `bounty_pot` view is `security_invoker`; both new FKs are indexed; one policy per command). Per-endpoint **rate-limiting** (spec §9) is deferred to a single app-wide pass in Plan 5.

**After merge:** controller applies the Plan-4 migration to cloud `gjomchhbsbtauzkpyjwa` via MCP, re-runs advisors, then authors **Plan 5 (Social & Polish)** — comments + interest, markdown sanitizer, the verify→payout signature animation, a standalone experts roster, and a fuller authed E2E — followed by the one-big ETL.
