# ETL — Restore v1 (Users + Ideas) — Design Spec

**Date:** 2026-06-06
**Status:** Design (brainstorming) — pending written-spec review, then implementation plan.
**Owner:** Esben (Apart Research)
**Depends on:** Phase-1 schema complete (Plans 1–5 merged + applied to cloud `gjomchhbsbtauzkpyjwa`).

---

## 1. Context & goal

The 2026 platform rebuild (Plans 1–5) recreated the schema from scratch with `legacy_id bigint unique` + `legacy jsonb` anchors on every table specifically so the original community's data could be restored losslessly. The original database survives only as a **full pg_dump cluster backup**: `~/Downloads/db_cluster-16-10-2025@02-48-41.backup` (plain SQL, includes the `auth` schema).

**Goal of Restore v1:** bring back the **people and the ideas** — at full auth fidelity so the 265 dormant users log in exactly as they did before — into the new cloud project. This is the first of two restore passes:

- **Restore v1 (this spec):** `auth.users` + `auth.identities` (verbatim), `public.users`→`profiles`(+`experts`), `categories`, `ideas`, `idea_categories`, `idea_relations`.
- **Restore v2 (deferred, its own spec):** `comments`, `interest`, funding pledges (`idea_user_funding_relation`→`idea_funding`), `results`→`answers`.

**Firmed decisions (brainstorming):**
- **Account reclaim = restore credentials verbatim** — re-import `auth.users` (incl. bcrypt `encrypted_password`) + `auth.identities` (Google/email links), preserving the original UUIDs. Returning users sign in with their exact old password or Google account; nothing to reclaim.
- **Run = direct-to-cloud, transactional, idempotent** — the cloud project is effectively empty (1 test user), so the load is additive. Every write is `on conflict do nothing`; the run asserts exact row counts and is safe to re-run.
- **Scope = minimal: users + ideas** (categories + idea↔idea relations folded in as idea metadata). Comments/interest/funding/answers and all experimental tables (books, achievements, collaboration_requests, superprojects, nodes/lists, problems) are **out of v1**.

## 2. Source → target inventory

| Old (backup) | Rows | New (target) | Notes |
|---|---|---|---|
| `auth.users` | 265 | `auth.users` | verbatim (preserve id, email, bcrypt hash) |
| `auth.identities` | 268 | `auth.identities` | verbatim (Google/email links); old dump already has `provider_id`+`id uuid` (current shape — no drift) |
| `public.users` | 265 | `public.profiles` (+ `public.experts` where `expert=true`) | profile fields + expert flag |
| `public.categories` | 19 | `public.categories` | `legacy_id` anchor; generate `slug` |
| `public.ideas` | 238 | `public.ideas` | `legacy_id` anchor; bigint→uuid |
| `public.idea_category_relation` | n | `public.idea_categories` | resolved via legacy_id maps |
| `public.idea_idea_relation` | n | `public.idea_relations` | resolved via legacy_id maps |

**Explicitly out of v1:** `comments`, `idea_user_interest_relation`, `idea_user_funding_relation`, `idea_user_mentorship_relation`, `results`, `problems`, `idea_problem_relation`, `nodes`, `nodes_ideas`, `superprojects`, `idea_superproject_relation`, `books`, `book_tags`, `achievements`, `collaboration_requests`, `saved_projects`.

## 3. Column mappings

### 3.1 `auth.users` (verbatim, on conflict (id) do nothing)
Insert the dump's columns into the current `auth.users` (the current table is a superset; skip the generated `confirmed_at`). Columns: `instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous`. Empty-string token defaults are inserted as-is.

### 3.2 `auth.identities` (verbatim, on conflict (id) do nothing)
Columns: `provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id`. Skip the generated `email` column.

### 3.3 `public.users` → `public.profiles` (on conflict (id) do nothing)
| profile column | source |
|---|---|
| `id` | `users.id` (same uuid) |
| `handle` | slug of `users.username`; **guaranteed-unique** by appending `-` + `substr(id::text,1,4)` when needed (mirrors `handle_new_user`); fallback to email-local part if username is null/blank |
| `display_name` | `users.user_metadata->>'name'` ?? `->>'full_name'` ?? `username` |
| `avatar_url` | `users.image` ?? `users.user_metadata->>'picture'` |
| `bio_md` | `nullif(trim(users.bio), '')` (old default is a single space) |
| `career_stage` | `users.career_stage` |
| `links` | `'{}'::jsonb` |
| `is_admin` | `false` (never import admin; the owner sets their own admin flag manually post-restore) |
| `legacy` | `{ like_weight, username (original), user_metadata }` |
| `created_at` | the matching `auth.users.created_at` (or `now()`) |

### 3.4 `public.experts` (where `users.expert = true`; on conflict (id) do nothing)
`id = users.id`, `status = 'approved'` (the old `expert` flag means a vetted expert), `featured = false`, `approved_by = null`, `approved_at = now()`.

### 3.5 `public.categories` (19; on conflict (legacy_id) do nothing)
`id = gen_random_uuid()`, `legacy_id = old.id`, `slug = slugify(title)` (guaranteed-unique with a numeric suffix on collision), `title = title`, `description = tooltip`, `priority = priority`, `legacy = { project_factory }`.

### 3.6 `public.ideas` (238; on conflict (legacy_id) do nothing)
| idea column | source / rule |
|---|---|
| `id` | `gen_random_uuid()` |
| `legacy_id` | `old.id` |
| `author_id` | `old."user"` (uuid; resolves directly because user UUIDs are preserved; `null` if absent) |
| `type` | `old.hypothesis ? 'hypothesis' : 'open_ended'` |
| `title` | `old.title` |
| `summary_md` | `old.summary` |
| `claim` | `null` (old data has no separate claim; the title carries the hypothesis) |
| `status` | `old.archived ? 'archived' : (old.finished ? 'resolved' : 'open')` |
| `resolution` | `null` |
| `importance` | `old.importance` (clamp bigint→int) |
| `from_date` | `old.from_date` |
| `contact` | `old.contact` |
| `currency` | `old.funding_currency` ?? `'USD'` |
| `published_at` | `old.created_at` (these were live, non-draft) |
| `created_at` | `old.created_at` |
| `legacy` | everything else, lossless: `{ experience, author, useful, success, sourced, difficulty, career_difficulty, verified_by_expert, filtered, verifier, funding_amount, funding_currency, funding_from, mentorship_from, project_factory, finished, finished_link, finished_date, archived, archive_reason }` |

> **Note (RLS):** the ETL runs as service-role/`postgres`, which **bypasses RLS** — so the `ideas` INSERT policy's "approved-expert author" pin and the `legacy_id`-must-be-null client pin do **not** apply; the loader sets `legacy_id`, any `author_id`, and any `status` freely. This is exactly the seam the `legacy_*` design reserved for the service-role ETL.
>
> **Note (archived visibility):** the `ideas` SELECT RLS hides only `draft`; restored `archived` ideas are therefore publicly viewable. Acceptable for v1 — revisit if archived should be hidden.

### 3.7 `public.idea_categories` (on conflict (idea_id, category_id) do nothing)
For each `idea_category_relation(idea bigint, category bigint)`: resolve `idea`→`ideas.legacy_id`→new uuid and `category`→`categories.legacy_id`→new uuid; insert `(idea_id, category_id)`. Skip rows where either side is unresolved.

### 3.8 `public.idea_relations` (on conflict (parent_id, child_id) do nothing)
For each `idea_idea_relation(id, parent bigint, child bigint, type)`: `legacy_id = old.id`, resolve parent/child via the ideas legacy_id map, carry `type`. Skip self-relations and unresolved rows.

## 4. Mechanism

A small **TypeScript ETL** under `scripts/etl/` that:

1. **Parses** the backup file's `COPY <table> (...) FROM stdin;` blocks for exactly the source tables in §2 (tab-delimited, `\N` = null, standard pg_dump escaping) into row objects.
2. **Transforms** per §3, building in-memory maps `oldIdeaId(bigint)→newUuid` and `oldCategoryId(bigint)→newUuid` (users keep their UUIDs, so no user remap), and resolving the relation tables against those maps.
3. **Emits an idempotent SQL artifact** `scripts/etl/restore-v1.generated.sql`: `begin;` → `alter table auth.users disable trigger on_auth_user_created;` → the `insert ... on conflict do nothing` batches in dependency order → `alter table auth.users enable trigger on_auth_user_created;` → a block of `do $$ ... assert ... $$` **count assertions** → `commit;`.

**Build + rehearse locally first** (sound engineering, not a separate approval gate): apply the generated SQL to a fresh local `supabase db reset` stack and confirm the count assertions pass and a spot-checked profile/idea resolves. The generated SQL is deterministic, so the rehearsed artifact is the one that runs at cloud.

**Run at cloud:** the **controller** executes the generated SQL against `gjomchhbsbtauzkpyjwa` via the **Supabase MCP** (`execute_sql`, which runs as `postgres` — it can write the `auth` schema, toggle the trigger, and run the transaction; no extra credentials needed). If the single payload is too large for one `execute_sql`, it is split into a few ordered calls (auth → profiles/experts → categories/ideas → relations), each `on conflict do nothing` so the sequence stays re-runnable; a final `execute_sql` runs the count checks. *(Alternative if the owner provides the project DB connection string: a direct `pg` client gives true single-transaction atomicity — swappable, same generated SQL.)*

### Order of operations
1. disable `on_auth_user_created` trigger
2. `auth.users`
3. `auth.identities`
4. `profiles`
5. `experts`
6. re-enable `on_auth_user_created` trigger
7. `categories`
8. `ideas`
9. `idea_categories`
10. `idea_relations`
11. assert counts

## 5. Idempotency, verification, rollback

- **Idempotent:** every insert is `on conflict do nothing` keyed on a stable column (`auth.users.id`, `identities.id`, `profiles.id`, `experts.id`, `*.legacy_id`, the join PKs). Re-running adds nothing and never errors; the 1 pre-existing test user is skipped.
- **Verification (assertions, abort on failure):** `auth.users ≥ 266`, `profiles ≥ 266`, `experts = count(expert=true)`, `categories = 19`, `ideas = 238`, `idea_categories = count(resolvable relations)`, `idea_relations = count(resolvable relations)`; plus **FK integrity** (no `ideas.author_id` pointing outside `profiles`; every `idea_categories` row resolves) and a **spot-check** (a named user's profile exists and is linked to their ideas).
- **Rollback:** wrapped in `begin/commit` (direct-connection path) or, on the batched MCP path, recoverable by `truncate` of the freshly-loaded tables (cloud has no other real data) and re-run. Manual sign-in smoke test (one restored account) before declaring success.

## 6. Security & PII

- The backup contains **PII** (265 real emails, bcrypt password hashes, OAuth tokens in `identity_data`). The ETL reads it **locally**; the generated `restore-v1.generated.sql` **contains PII + password hashes and is gitignored** — only the parametric TypeScript is committed. No PII is logged (the script prints counts, not rows).
- The service-role/secret key (`SUPABASE_API_KEY` in env) is server-only; the cloud load is controller-driven via MCP (no key in the repo).
- Restoring our own users' auth records into our own new project is an internal data migration (no new third-party disclosure). bcrypt hashes are safe to carry; **enable Leaked-Password Protection** in the project Auth settings (separate dashboard toggle) so any *future* password changes are checked.

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `handle` null/duplicate from old `username` | slugify + guaranteed-unique `-<id4>` suffix; email-local fallback |
| `auth.users` column drift vs current | insert an explicit compatible column list; skip generated `confirmed_at`; the dump's schema is recent (has `is_anonymous`, `is_sso_user`) so it aligns |
| `auth.identities` drift | none observed — old dump already has `provider_id` + `id uuid`; skip generated `email` |
| pg_dump `COPY` parsing (escapes, `\N`, embedded tabs/newlines in jsonb/text) | use a tested COPY-block parser; rehearse locally and assert counts before cloud |
| Large payload for MCP `execute_sql` | split into ordered, individually-idempotent batches; final count check |
| `ideas.author_id` referencing a user not in the 265 | FK is `on delete set null`; insert `null` when unresolved (count + log how many) |
| Re-run / partial failure | `on conflict do nothing` everywhere + truncate-and-retry on the empty cloud |

## 8. Out of scope / next

- **Restore v2** (own spec): comments, interest, funding pledges, results→answers — once v1 is verified in production.
- Mentorship/funding **text** fields from old ideas are preserved in `ideas.legacy` for v2's funding reconstruction.
- Post-v1: re-run `get_advisors`; set the owner's `is_admin`; optional `handle` cleanup pass; decide archived-idea visibility.
