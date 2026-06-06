# ETL Restore v2 — Comments, Interest, Answers, Votes (design)

**Date:** 2026-06-06 · **Status:** approved by owner (this session)
**Depends on:** Restore v1 (merged PR #49, applied to cloud 2026-06-06) — all user + idea FK targets exist with `legacy_id` anchors.

## 1. Goal

Restore the remaining community content from the old backup
(`~/Downloads/db_cluster-16-10-2025@02-48-41.backup`) into the new schema, and ship the
**idea voting feature** (new `idea_votes` table + RLS + minimal UI) seeded with the old likes.

| Source (old) | Rows | Target (new) | Notes |
|---|---|---|---|
| `comments` | 83 | `public.comments` | incl. 13 replies, 7 authorless, 4 empty-text |
| `idea_user_interest_relation` | 133 | `public.interest` | 0 duplicate (user, idea) pairs |
| `results` | 5 | `public.answers` (+ `answer_artifacts`) | historical outputs → `status='verified'` |
| `idea_user_likes` | 387 | `public.idea_votes` (NEW) | each like = one upvote; weight → legacy |
| `idea_user_funding_relation` | **0** | — | empty; nothing to restore |
| tail (`saved_projects` 1, `project_results` 1, `collaboration_requests` 1) + cut features (`nodes`, `nodes_ideas`, `superprojects`, `books`, `book_tags`, `achievements`, `problems`, `metrics`, `investments`, `rejections`, `idea_problem_relation`, `idea_superproject_relation`, `idea_user_mentorship_relation`) | — | **skipped** (owner decision) | backup remains the permanent archive |

**Verified source facts (probed 2026-06-06):** referential integrity is perfect — every
`author`/`user`/`idea` reference in all four source tables resolves against the old `users`
(265) and `ideas` (238) sets. All 13 comment `reply_to` values point to lower (earlier) ids.
0 anonymous comments. 387 likes span 202 ideas / 67 users.

## 2. Owner decisions (this session)

1. **Results → verified answers** (not skipped): they are accepted historical outputs.
2. **Likes → a real up/down-vote feature**: new `idea_votes` table, ETL seeds old likes as
   upvotes, minimal UI ships in this plan.
3. **Tail + cut features skipped.**
4. Each old like = **one upvote** (`value = 1`); the old `size` weight survives in `legacy`.

## 3. New migration: `idea_votes` (+ totals view)

```sql
create table public.idea_votes (
  id         uuid primary key default gen_random_uuid(),
  legacy_id  bigint unique,
  idea_id    uuid not null references public.ideas(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade, -- a vote without a voter is meaningless
  value      smallint not null check (value in (-1, 1)),
  legacy     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (idea_id, profile_id)
);
```

- Indexes: `profile_id` (covers its FK); the `unique (idea_id, profile_id)` doubles as the
  `idea_id` index (leading column) — no separate idea_id index.
- **RLS mirrors `interest` exactly:**
  - SELECT: idea visible (leverages ideas RLS via `exists`) **or** own row.
  - INSERT (`to authenticated`): `auth.uid() = profile_id`, `legacy_id is null and
    legacy = '{}'::jsonb` pinned, idea visible. (The `value in (-1,1)` rule lives on the table
    CHECK constraint only — a single deterministic error source, not duplicated in the policy.)
  - DELETE (`to authenticated`): own row.
  - **No UPDATE** — switching a vote is delete + re-insert (same toggle pattern as `interest`).
- **`idea_vote_totals` view** (`security_invoker = true`, mirrors `bounty_pot` including its
  explicit `grant select … to anon, authenticated`): `idea_id, score (sum), up_count, down_count`
  — grouped over `idea_votes`.
- Accepted product decision: individual votes — including downvotes — are publicly attributable
  via the API (same visibility model as comments).
- pgTAP coverage for all policies (vote-as-self ok, vote-as-other denied, legacy pinning,
  delete-own-only, draft-idea invisible, view respects invoker).
- Applied to cloud via MCP `apply_migration` **before** the data load (controller step).

## 4. ETL mechanics (`scripts/etl/restore-v2.ts`)

Reuses `parse-dump.ts`, `sql.ts`, `emit.ts` machinery verbatim; new transforms in
`transform.ts`; a `buildDocumentV2` emitter. Output: gitignored
`scripts/etl/restore-v2.generated.sql` (covered by the existing `scripts/etl/*.generated.sql`
ignore). CLI logs **counts only**, never row contents.

**Envelope (same as v1):** `begin;` → `set session_replication_role = replica;` → inserts →
reply-to update → `set session_replication_role = origin;` → `do $$ … assert … $$;` →
`commit;`. Conflict handling: `on conflict (legacy_id) do nothing` for comments/answers/artifacts;
**targetless `on conflict do nothing` for interest/idea_votes** — those tables also carry
`unique (idea_id, profile_id)`, and an organic post-restore row on the same pair must displace
the legacy insert rather than abort the transaction (also keeps re-runs idempotent once organic
rows exist).
Applied with fail-loud transport (`psql -v ON_ERROR_STOP=1` locally; Management API for cloud —
any raised error aborts the whole transaction).

**FK resolution — scalar subqueries, resolved at apply time.** v1 minted the idea UUIDs at
generation time, so v2 cannot know them statically; instead every idea reference is emitted as
`(select id from public.ideas where legacy_id = N)`. One artifact therefore works on both the
local rehearsal stack and cloud, stays idempotent, and a missing parent makes the insert fail
loudly (null into a `not null` column) instead of silently mis-linking. Profile references stay
**literal UUIDs** (v1 preserved them verbatim). At ~600 rows the subquery cost is negligible.
(Rejected alternative: pre-querying the live DB to emit literal UUIDs — couples the artifact to
one environment and adds a moving part for zero practical gain.)

**Comment threading — two-pass.** A multi-row INSERT cannot see its own rows, so same-statement
subselects on `comments` would fail. Pass 1 inserts all 83 comments with `reply_to = null`;
pass 2 is one idempotent
`update public.comments c set reply_to = (select p.id from public.comments p where p.legacy_id = <old reply_to>) where c.legacy_id = <id> and c.reply_to is null;`
per reply row (13 statements).

## 5. Column mappings (unmapped → `legacy` jsonb, lossless)

**comments → public.comments**
- `id → legacy_id` · `created_at → created_at` · `idea → idea_id` (subquery) ·
  `author → author_id` (literal uuid; the 7 null-author rows stay null) · `text → body_md`
  (the 4 empty-text rows are kept as `''` — they are real thread anchors; `body_md` is
  `not null`, `''` satisfies it) · `reply_to` → pass-2 update.
- legacy: `{ reply_to (old id), anon_author, anon_author_url, upvotes }` (nulls dropped).

**idea_user_interest_relation → public.interest**
- `id → legacy_id` · `created_at` · `idea → idea_id` (subquery) · `user → profile_id` ·
  `how → note_md` (empty string → null).
- legacy: `{ contact_if_started }`.
- `unique (idea_id, profile_id)` is safe: 0 duplicate pairs in the source.

**results → public.answers (+ answer_artifacts)**
- `id → legacy_id` · `created_at → created_at` · `idea → idea_id` (subquery) ·
  `user → submitter_id` · `title → title`, with fallback for empty titles:
  `'Result: ' || <old idea title>` (computed at generation time from the parsed ideas block) ·
  `description → explanation_md` (empty → null) · `status = 'verified'` ·
  `verified_at = created_at` · `verified_by = null` (the old table names no verifier) ·
  payout columns null/default (`payout_currency 'USD'`).
- legacy: `{ author (free-text names), image_link, type, link, from_date, original }`.
- One `answer_artifacts` row per result with non-empty `link` (**all 5 have one**):
  `legacy_id` ← old result id (conflict target) · `answer_id` (subquery on
  `answers.legacy_id`) · `kind = 'url'` · `url = link` · `label = null` ·
  `created_at` ← result created_at.
- Note: `answers.updated_at` defaults to now() — acceptable (restore time is the last touch).

**idea_user_likes → public.idea_votes**
- `id → legacy_id` · `created_at` · `idea → idea_id` (subquery) · `user → profile_id` ·
  `value = 1`.
- legacy: `{ size }`.
- If the source ever held duplicate (user, idea) likes, `unique (idea_id, profile_id)` +
  `on conflict (legacy_id) do nothing` would still abort (unique violation is a different
  conflict target) — the transform must **dedupe on (user, idea), keeping the earliest**, and
  log the dropped count. (Probe says 387 distinct pairs — the dedupe is a guard, not a fix.)

**Assertions (inside the transaction, after `origin`):**
- counts: `comments >= 83`, `interest >= 133`, `answers >= 5`, `idea_votes >= 387`,
  `answer_artifacts >= 5`.
- FK orphan scans (FKs were deferred under replica): comments→ideas/profiles,
  interest→ideas/profiles, idea_votes→ideas/profiles, answers→ideas/profiles,
  reply_to→comments, artifacts→answers. All must be 0 broken.
- replies: `count(reply_to is not null) >= 13`.

## 6. Vote UI (minimal, this plan)

- **Idea detail page:** compact `▲ score ▼` control. Own active upvote renders in
  `--green-deep` (small mark on white, per styleguide §1), active downvote in `--neg`
  (the semantic negative); inactive arrows `--muted`.
  Toggle semantics: tap same arrow = remove vote (DELETE); tap other arrow = DELETE +
  INSERT. Optimistic update, `snappy` spring, interruptible. Signed-out users see the
  control disabled with a link to `/login?next=<idea>`.
- **`/ideas` cards:** show the score (read from `idea_vote_totals`, coalesced to 0 in the
  query layer — the view omits unvoted ideas).
- **Sort-by-score (owner addition):** `/ideas` gains a sort control — `Newest` (default,
  current behavior) · `Top` (score desc, ties broken by `created_at` desc). Driven by a
  `?sort=top` URL param read in the server load; the load merges the totals into the idea
  list and sorts server-side (238 ideas — no pagination concerns). The control mirrors the
  existing type-filter link nav on `/ideas` (two options don't warrant a dropdown).
- Server load functions join/fetch totals; mutations via plain supabase inserts/deletes
  (RLS does the enforcement — no RPCs needed).

## 7. Process & safety (same regime as v1)

- **Subagents:** build on **synthetic fixtures only**; must never read the real backup, touch
  cloud, or edit `CLAUDE.md`/`docs/`/`.claude/`/`src_legacy_v0/`. Local rehearsal and cloud
  apply are **controller-only** tasks.
- **PII:** backup + generated artifact never committed (gitignore already covers
  `scripts/etl/*.generated.sql`); CLI prints counts only.
- **Cloud transport:** owner's network blocks outbound 5432/6543 — apply via Supabase
  Management API `POST /v1/projects/gjomchhbsbtauzkpyjwa/database/query` over 443 (proven in
  v1; 1MB artifact OK; v2's will be far smaller). Requires a fresh owner PAT (the v1 token is
  to be revoked); remind the owner to revoke it again afterwards.
- **Order of operations:** merge PR → MCP `apply_migration` (`idea_votes`) on cloud → local
  rehearsal (fresh stack: v1 artifact, then migration, then v2 artifact, then idempotency
  re-run) → cloud apply → cloud count/orphan verification → `get_advisors` re-run (expect:
  baseline + nothing new; `idea_vote_totals` is security_invoker).
- **Plan review:** 6-lens adversarial Workflow review of the implementation plan before
  building (per [[adversarial-plan-review-before-coding]]).

## 8. Risks

- **Local rehearsal needs v1 state first** — the rehearsal sequence above makes v1's artifact a
  prerequisite; the v1 generated file still exists locally (regenerable from the backup if not).
- **`answers` insert under RLS-bypass:** inserts run as table owner (`postgres`), bypassing the
  INSERT policy's pinning (which forbids `status='verified'` + legacy columns) — that is the
  point: the policy pins *clients*, the ETL is privileged. No policy changes needed.
- **Verified answers become publicly readable** (existing SELECT policy) — intended: these are
  historical public outputs.
- **`handle_new_user` trigger suppression** is irrelevant here (no auth rows in v2), but the
  replica bracket is kept for FK deferral + any content triggers.
- **Vote UI double-submit race** (rapid toggle) — the unique constraint makes the worst case a
  23505 the client treats as no-op; optimistic state reconciles on the next read.
