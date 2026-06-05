# ETL — Restore v1 (Users + Ideas) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development for Tasks 1–4. Steps use checkbox (`- [ ]`) syntax. **Tasks 5–6 are CONTROLLER-ONLY** (they touch the real PII backup + the cloud project) — a subagent must NOT run them.

**Goal:** Build a tested, idempotent ETL that restores the original **265 users (verbatim auth) + 238 ideas** (+ categories & relations) from the pg_dump backup into the new schema, emitting one re-runnable SQL artifact that the controller applies to cloud.

**Architecture:** A small TypeScript ETL under `scripts/etl/`: a pg_dump **COPY-block parser** → pure **transforms** (old→new per the spec's §3 mappings, with bigint→uuid remapping) → a **SQL emitter** that writes an idempotent `restore-v1.generated.sql` (trigger-disable → `insert … on conflict do nothing` batches → trigger-enable → count assertions, wrapped `begin/commit`). The generated SQL is applied to a fresh **local** stack to rehearse (controller), then to **cloud** via the Supabase MCP (controller). Unit tests use **synthetic fixtures only** — never the real PII backup.

**Tech Stack:** TypeScript run via `tsx` (add as devDep) or `node --import tsx`; `vitest` for unit tests (already present). No DB driver needed (the emitter produces SQL; rehearsal/cloud apply it). Spec: `docs/superpowers/specs/2026-06-06-etl-restore-v1-design.md`.

**Security:** the real backup + the generated `*.generated.sql` contain PII (emails, bcrypt hashes, OAuth tokens) — both are **gitignored**; only parametric code + synthetic fixtures are committed. Subagents work with fixtures only.

---

## Key design decisions
- **Emit SQL literals, rely on assignment casts.** Every value from the dump is emitted as either `NULL` or a single-quoted, quote-doubled literal (`'…''…'`); Postgres assignment-casts the unknown-typed literal to each column's type on INSERT (works for int/bool/timestamptz/jsonb/uuid). Computed values (`gen_random_uuid()`, `now()`, built `legacy` jsonb) are emitted as SQL expressions. This avoids per-column type logic.
- **Standard string literals.** `standard_conforming_strings` is on by default, so backslashes in the (already-unescaped) dump text are literal — JSON `\uXXXX`/`\/` survive correctly inside `'…'`. Only `'` needs doubling.
- **Idempotent + additive.** Every insert `on conflict do nothing` on a stable key; the cloud's 1 pre-existing test user is skipped; safe to re-run.
- **User UUIDs preserved** → no user remap; only `ideas`/`categories` get bigint→uuid maps, and the relation tables resolve against them.

---

## File structure

| File | Responsibility |
|---|---|
| `scripts/etl/parse-dump.ts` | parse pg_dump `COPY … FROM stdin` blocks → `{columns, rows}` |
| `scripts/etl/sql.ts` | SQL value helpers: `lit()`, `jsonbLit()`, `insertBatch()` |
| `scripts/etl/transform.ts` | pure transforms: `slugify`, `uniqueHandle`, `toProfile`, `toExpert`, `toCategory`, `toIdea`, `resolveIdeaCategories`, `resolveIdeaRelations` |
| `scripts/etl/emit.ts` | assemble the ordered idempotent SQL document + assertions |
| `scripts/etl/restore-v1.ts` | CLI: read backup → parse → transform → emit → write `restore-v1.generated.sql` |
| `scripts/etl/*.test.ts` | vitest units (fixtures only) |
| `scripts/etl/fixtures/` | tiny synthetic COPY snippets |
| `.gitignore` | ignore `scripts/etl/*.generated.sql` |

---

## Task 1: COPY-block parser

**Files:** `scripts/etl/parse-dump.ts`, `scripts/etl/parse-dump.test.ts`, `.gitignore`, `package.json`

- [ ] **Step 1: Add tooling.** `npm install -D tsx`. In `.gitignore` add a line: `scripts/etl/*.generated.sql`. In `package.json` `scripts` add `"etl:restore-v1": "tsx scripts/etl/restore-v1.ts"`.

- [ ] **Step 2: Write the failing test** `scripts/etl/parse-dump.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { parseCopyBlock } from './parse-dump';

const DUMP = [
  'CREATE TABLE public.ideas (id bigint);',
  'COPY public.ideas (id, title, summary, archived) FROM stdin;',
  '1\tHello\tA \\t tabbed\\nline\t f',
  '2\t\\N\tplain\tt',
  '\\.',
  'COPY public.other (x) FROM stdin;',
  '9',
  '\\.'
].join('\n');

describe('parseCopyBlock', () => {
  it('extracts columns + rows for the named table, unescaping and \\N→null', () => {
    const b = parseCopyBlock(DUMP, 'public.ideas');
    expect(b.columns).toEqual(['id', 'title', 'summary', 'archived']);
    expect(b.rows.length).toBe(2);
    expect(b.rows[0]).toEqual({ id: '1', title: 'Hello', summary: 'A \t tabbed\nline', archived: ' f' });
    expect(b.rows[1]).toEqual({ id: '2', title: null, summary: 'plain', archived: 't' });
  });
  it('throws if the table COPY block is absent', () => {
    expect(() => parseCopyBlock(DUMP, 'public.missing')).toThrow();
  });
});
```

- [ ] **Step 3: Implement** `scripts/etl/parse-dump.ts`

```ts
export type CopyBlock = { columns: string[]; rows: Record<string, string | null>[] };

const UNESCAPE: Record<string, string> = { t: '\t', n: '\n', r: '\r', '\\': '\\' };

function unescapeField(f: string): string | null {
  if (f === '\\N') return null;
  return f.replace(/\\(.)/g, (_, c) => UNESCAPE[c] ?? c);
}

/** Parse a single `COPY <table> (cols) FROM stdin;` … `\.` block from a pg_dump text. */
export function parseCopyBlock(dump: string, table: string): CopyBlock {
  const lines = dump.split('\n');
  const startRe = new RegExp(`^COPY ${table.replace('.', '\\.')} \\(([^)]*)\\) FROM stdin;`);
  let i = lines.findIndex((l) => startRe.test(l));
  if (i < 0) throw new Error(`COPY block for ${table} not found`);
  const columns = startRe.exec(lines[i])![1].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
  const rows: Record<string, string | null>[] = [];
  for (i = i + 1; i < lines.length && lines[i] !== '\\.'; i++) {
    const fields = lines[i].split('\t');
    const row: Record<string, string | null> = {};
    columns.forEach((c, j) => (row[c] = unescapeField(fields[j] ?? '\\N')));
    rows.push(row);
  }
  return { columns, rows };
}
```

> **Caveat for the implementer:** pg_dump emits embedded newlines in text as `\n` (escaped), so a logical row never spans output lines — line-splitting is safe. Verify against the real backup in Task 5 (a row count mismatch would reveal any multi-line edge case).

- [ ] **Step 4: Run** `npx vitest run scripts/etl/parse-dump.test.ts` → PASS.
- [ ] **Step 5: Commit** `git add scripts/etl/parse-dump.ts scripts/etl/parse-dump.test.ts .gitignore package.json package-lock.json && git commit -m "feat(etl): pg_dump COPY-block parser"`

---

## Task 2: SQL value helpers

**Files:** `scripts/etl/sql.ts`, `scripts/etl/sql.test.ts`

- [ ] **Step 1: Write the failing test** `scripts/etl/sql.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { lit, jsonbLit, insertRows } from './sql';

describe('sql helpers', () => {
  it('lit() quotes + doubles single-quotes; null→NULL; raw SQL passes through', () => {
    expect(lit(null)).toBe('NULL');
    expect(lit("O'Brien")).toBe("'O''Brien'");
    expect(lit('a\\b')).toBe("'a\\b'");                 // backslash literal (standard_conforming_strings)
    expect(lit({ sql: 'now()' })).toBe('now()');
  });
  it('jsonbLit() emits a cast jsonb literal, dropping undefined keys', () => {
    expect(jsonbLit({ a: 1, b: undefined, c: "x'y" })).toBe('\'{"a":1,"c":"x\'\'y"}\'::jsonb');
  });
  it('insertRows() builds an idempotent multi-row INSERT', () => {
    const sql = insertRows('public.t', ['id', 'name'], [
      { id: lit('1'), name: lit("A'B") },
      { id: lit('2'), name: 'NULL' }
    ], 'id');
    expect(sql).toContain('insert into public.t (id, name) values');
    expect(sql).toContain("('1', 'A''B')");
    expect(sql).toContain("('2', NULL)");
    expect(sql.trim().endsWith('on conflict (id) do nothing;')).toBe(true);
  });
  it('insertRows() returns empty string for no rows', () => {
    expect(insertRows('public.t', ['id'], [], 'id')).toBe('');
  });
});
```

- [ ] **Step 2: Implement** `scripts/etl/sql.ts`

```ts
export type Cell = string | null | { sql: string };

/** A SQL scalar literal. null→NULL; {sql} passes through verbatim; strings are single-quoted with '' escaping. */
export function lit(v: Cell): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'object') return v.sql;
  return `'${v.replace(/'/g, "''")}'`;
}

/** A jsonb literal from a JS object (undefined values dropped). */
export function jsonbLit(obj: Record<string, unknown>): string {
  const clean = Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
  return `${lit(JSON.stringify(clean))}::jsonb`;
}

/** An idempotent multi-row INSERT. `cells` rows are pre-rendered SQL (use lit()/jsonbLit()). */
export function insertRows(
  table: string, columns: string[], rows: Record<string, string>[], conflictTarget: string
): string {
  if (rows.length === 0) return '';
  const tuples = rows.map((r) => `  (${columns.map((c) => r[c] ?? 'NULL').join(', ')})`).join(',\n');
  return `insert into ${table} (${columns.join(', ')}) values\n${tuples}\non conflict (${conflictTarget}) do nothing;\n`;
}
```

- [ ] **Step 3: Run** `npx vitest run scripts/etl/sql.test.ts` → PASS.
- [ ] **Step 4: Commit** `git add scripts/etl/sql.ts scripts/etl/sql.test.ts && git commit -m "feat(etl): SQL literal + idempotent-insert helpers"`

---

## Task 3: Transforms

**Files:** `scripts/etl/transform.ts`, `scripts/etl/transform.test.ts`

Implements the spec §3 mappings as pure functions over parsed rows. Each returns a row of pre-rendered SQL cells (via `lit`/`jsonbLit`) keyed by target column, plus the bigint→uuid maps for ideas/categories.

- [ ] **Step 1: Write the failing test** `scripts/etl/transform.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { slugify, uniqueHandle, ideaStatus, ideaType } from './transform';

describe('transform helpers', () => {
  it('slugify', () => {
    expect(slugify('AI Safety & Alignment!')).toBe('ai-safety-alignment');
    expect(slugify('  Multiple   spaces ')).toBe('multiple-spaces');
  });
  it('uniqueHandle dedupes with an id-suffix and falls back to the email local part', () => {
    const used = new Set<string>();
    expect(uniqueHandle('alice', 'alice@x.com', 'aaaa1111', used)).toBe('alice');
    expect(uniqueHandle('alice', 'alice2@x.com', 'bbbb2222', used)).toBe('alice-bbbb');  // collision → suffix
    expect(uniqueHandle(null, 'carol@x.com', 'cccc3333', used)).toBe('carol');           // null username → email local
    expect(uniqueHandle('', '', 'dddd4444', used)).toBe('user-dddd');                    // nothing → user-<id4>
  });
  it('ideaStatus maps archived/finished/open precedence', () => {
    expect(ideaStatus({ archived: 't', finished: 'f' })).toBe('archived');
    expect(ideaStatus({ archived: 'f', finished: 't' })).toBe('resolved');
    expect(ideaStatus({ archived: 'f', finished: 'f' })).toBe('open');
  });
  it('ideaType maps the hypothesis flag', () => {
    expect(ideaType('t')).toBe('hypothesis');
    expect(ideaType('f')).toBe('open_ended');
  });
});
```

- [ ] **Step 2: Implement** `scripts/etl/transform.ts` — exported pure helpers + the row builders. Minimum exported surface (the test pins the first four; implement the rest to the §3 mapping):

```ts
import { lit, jsonbLit, type Cell } from './sql';

export function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const bool = (v: string | null) => v === 't' || v === 'true';

export function uniqueHandle(username: string | null, email: string | null, id: string, used: Set<string>): string {
  const id4 = id.replace(/-/g, '').slice(0, 4);
  let base = slugify(username ?? '') || slugify((email ?? '').split('@')[0] ?? '') || `user-${id4}`;
  let h = base;
  if (used.has(h)) h = `${base}-${id4}`;
  let n = 2;
  while (used.has(h)) h = `${base}-${id4}-${n++}`;
  used.add(h);
  return h;
}

export const ideaType = (hypothesis: string | null) => (bool(hypothesis) ? 'hypothesis' : 'open_ended');
export const ideaStatus = (r: { archived: string | null; finished: string | null }) =>
  bool(r.archived) ? 'archived' : bool(r.finished) ? 'resolved' : 'open';

// Row builders return Record<targetColumn, renderedSqlString>. Examples (implement all per spec §3):
//
// toProfile(u, displayName, handle): { id: lit(u.id), handle: lit(handle), display_name: lit(displayName),
//   avatar_url: lit(u.image ?? metaPicture), bio_md: lit(nullifBlank(u.bio)), career_stage: lit(u.career_stage),
//   links: "'{}'::jsonb", is_admin: 'false', legacy: jsonbLit({ like_weight: u.like_weight, username: u.username }),
//   created_at: lit(createdAt ?? { sql: 'now()' }) }
//
// toIdea(i, newId): { id: lit(newId), legacy_id: lit(i.id), author_id: lit(i.user), type: lit(ideaType(i.hypothesis)),
//   title: lit(i.title), summary_md: lit(i.summary), claim: 'NULL', status: lit(ideaStatus(i)),
//   importance: lit(i.importance), from_date: lit(i.from_date), contact: lit(i.contact),
//   currency: lit(i.funding_currency ?? 'USD'), published_at: lit(i.created_at), created_at: lit(i.created_at),
//   legacy: jsonbLit({ experience: i.experience, author: i.author, useful: i.useful, success: i.success,
//     sourced: i.sourced, difficulty: i.difficulty, career_difficulty: i.career_difficulty,
//     verified_by_expert: i.verified_by_expert, filtered: i.filtered, verifier: i.verifier,
//     funding_amount: i.funding_amount, funding_currency: i.funding_currency, funding_from: i.funding_from,
//     mentorship_from: i.mentorship_from, project_factory: i.project_factory, finished: i.finished,
//     finished_link: i.finished_link, finished_date: i.finished_date, archived: i.archived,
//     archive_reason: i.archive_reason }) }
//
// Also: toExpert(u) (only when bool(u.expert)); toCategory(c, newId) (slug uniqueness via a Set, description=tooltip);
// resolveIdeaCategories(rels, ideaMap, catMap) → {idea_id, category_id} dropping unresolved;
// resolveIdeaRelations(rels, ideaMap) → {legacy_id, parent_id, child_id, type} dropping self/unresolved.
```

- [ ] **Step 3: Run** `npx vitest run scripts/etl/transform.test.ts` → PASS. (Add a couple of `toIdea`/`toProfile` shape assertions while implementing.)
- [ ] **Step 4: Commit** `git add scripts/etl/transform.ts scripts/etl/transform.test.ts && git commit -m "feat(etl): old→new row transforms (profiles/experts/categories/ideas/relations)"`

---

## Task 4: SQL emitter + CLI runner

**Files:** `scripts/etl/emit.ts`, `scripts/etl/emit.test.ts`, `scripts/etl/restore-v1.ts`

- [ ] **Step 1: Write the failing test** `scripts/etl/emit.test.ts` — assert the document's shape (ordering + assertions), using a tiny in-memory parsed dataset:

```ts
import { describe, it, expect } from 'vitest';
import { buildDocument } from './emit';

describe('buildDocument', () => {
  it('wraps in a transaction, toggles the trigger around the auth import, and ends with count assertions', () => {
    const doc = buildDocument({
      authUsers: [{ id: '11111111-1111-1111-1111-111111111111' }] as any,
      identities: [], users: [], ideas: [], categories: [], ideaCats: [], ideaRels: []
    } as any);
    expect(doc.startsWith('begin;')).toBe(true);
    expect(doc).toContain('alter table auth.users disable trigger on_auth_user_created;');
    const disableAt = doc.indexOf('disable trigger');
    const authInsertAt = doc.indexOf('insert into auth.users');
    const enableAt = doc.indexOf('enable trigger');
    expect(disableAt).toBeLessThan(authInsertAt);
    expect(authInsertAt).toBeLessThan(enableAt);
    expect(doc).toMatch(/do \$\$[\s\S]*assert[\s\S]*\$\$/);   // count-assertion block
    expect(doc.trim().endsWith('commit;')).toBe(true);
  });
});
```

- [ ] **Step 2: Implement** `scripts/etl/emit.ts` — `buildDocument(data)` assembles, in the spec §4 order: `begin;` → disable trigger → `insertRows` for `auth.users`, `auth.identities`, `public.profiles`, `public.experts` → enable trigger → `insertRows` for `public.categories`, `public.ideas`, `public.idea_categories`, `public.idea_relations` → a `do $$ begin assert (select count(*) from public.ideas) >= 238; assert (select count(*) from public.profiles) >= 266; … end $$;` block (use `>=` so re-runs/the pre-existing test row don't trip it) → `commit;`. Conflict targets: `id` for auth/profiles/experts, `legacy_id` for categories/ideas/idea_relations, `(idea_id, category_id)` for idea_categories, `(parent_id, child_id)` for idea_relations (pick the matching unique key).

- [ ] **Step 3: Implement the CLI** `scripts/etl/restore-v1.ts`

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { parseCopyBlock } from './parse-dump';
import * as t from './transform';
import { buildDocument } from './emit';

const BACKUP = process.argv[2] ?? `${process.env.HOME}/Downloads/db_cluster-16-10-2025@02-48-41.backup`;
const OUT = new URL('./restore-v1.generated.sql', import.meta.url).pathname;

const dump = readFileSync(BACKUP, 'utf8');
const authUsers = parseCopyBlock(dump, 'auth.users').rows;
const identities = parseCopyBlock(dump, 'auth.identities').rows;
const users = parseCopyBlock(dump, 'public.users').rows;
const ideas = parseCopyBlock(dump, 'public.ideas').rows;
const categories = parseCopyBlock(dump, 'public.categories').rows;
const ideaCatRels = parseCopyBlock(dump, 'public.idea_category_relation').rows;
const ideaRels = parseCopyBlock(dump, 'public.idea_idea_relation').rows;

// build maps + transform (see transform.ts), then:
const doc = buildDocument(/* transformed batches */);
writeFileSync(OUT, doc, 'utf8');
console.log(`wrote ${OUT}: users=${authUsers.length} ideas=${ideas.length} categories=${categories.length} ` +
  `identities=${identities.length} idea_categories=${ideaCatRels.length} idea_relations=${ideaRels.length}`);
```

(Wire the transforms: build `oldIdeaId→newUuid` / `oldCatId→newUuid` maps with `crypto.randomUUID()`, a shared `used` handle Set, then map each batch. The CLI prints only **counts**, never row contents — PII discipline.)

- [ ] **Step 4: Verify** `npm run check` stays 0 errors (the script is TS; ensure it's excluded from the SvelteKit app types or type-checks cleanly). Run `npx vitest run scripts/etl` → all green.
- [ ] **Step 5: Commit** `git add scripts/etl/emit.ts scripts/etl/emit.test.ts scripts/etl/restore-v1.ts && git commit -m "feat(etl): SQL emitter + restore-v1 CLI"`

---

## Task 5 (CONTROLLER ONLY — real PII backup, local): rehearse

> A subagent must NOT do this — it reads the real backup. The controller runs it.

- [ ] Generate against the real backup: `npm run etl:restore-v1` → writes `scripts/etl/restore-v1.generated.sql`; confirm the printed counts are **users=265, ideas=238, categories=19, identities=268**.
- [ ] Fresh local stack: `supabase db reset`. Apply the artifact: `docker exec -i supabase_db_aisafetyideas psql -U postgres -d postgres < scripts/etl/restore-v1.generated.sql`. The embedded `assert` block must pass (psql exits non-zero on assertion failure).
- [ ] Verify locally:
  - counts: `select (select count(*) from auth.users), (select count(*) from public.profiles), (select count(*) from public.experts), (select count(*) from public.ideas), (select count(*) from public.categories), (select count(*) from public.idea_categories), (select count(*) from public.idea_relations);`
  - FK integrity: `select count(*) from public.ideas i left join public.profiles p on p.id=i.author_id where i.author_id is not null and p.id is null;` → **0**.
  - spot-check: a named user's profile + their ideas resolve; an idea's `legacy` jsonb carries the old fields.
  - re-run idempotency: apply the artifact a second time → assertions still pass, counts unchanged.
- [ ] Confirm `git status` shows `restore-v1.generated.sql` as **ignored** (not staged). Do not commit it.

---

## Task 6 (CONTROLLER ONLY — cloud + PII): load to cloud

> Controller-only via the Supabase MCP. Subagents never touch cloud.

- [ ] Apply the (rehearsed, deterministic) artifact to `gjomchhbsbtauzkpyjwa` via MCP `execute_sql`. If the payload is too large for one call, split on the batch boundaries (auth.users → identities → profiles/experts → categories/ideas → relations), each already `on conflict do nothing`; the trigger disable/enable must bracket the auth-users insert. Finish with the count-assertion block.
- [ ] Verify on cloud (MCP `execute_sql`): the same count + FK-integrity queries as Task 5; expect `profiles ≈ 266`, `ideas = 238`, `categories = 19`.
- [ ] **Sign-in smoke test:** confirm one restored account can authenticate (the owner's own Google login is the easiest check) and that `/ideas` browses the restored ideas.
- [ ] Re-run `get_advisors` (security + performance) — expect no new findings beyond the accepted set.
- [ ] Set the owner's admin flag manually (not imported): `update public.profiles set is_admin = true where id = '<owner uuid>';` (and add an `experts` row if desired).
- [ ] Update the project memory: Restore v1 complete (counts), and that **Restore v2** (comments/interest/funding/answers) is the next ETL.

---

## Done-when (Restore v1 acceptance)
- The ETL is fully unit-tested (parser, sql helpers, transforms, emitter) on synthetic fixtures; `npx vitest run scripts/etl` green; `npm run check` 0 errors.
- `npm run etl:restore-v1` deterministically emits a gitignored `restore-v1.generated.sql` (counts: 265 users / 268 identities / 265 users→profiles / 238 ideas / 19 categories).
- Applied to a fresh **local** stack, the embedded assertions pass, FK integrity holds (0 orphan authors), and a re-run is a no-op.
- Applied to **cloud**, counts + FK integrity verified; a restored account signs in; `/ideas` shows restored ideas; advisors clean; owner admin set.
- No PII committed (backup + `*.generated.sql` gitignored); the CLI logs counts only.

**After this:** brainstorm + plan **Restore v2** (comments, interest, funding pledges → `idea_funding`, `results` → `answers`) reusing the same parser/emitter machinery.
