# ETL Restore v2 (Comments, Interest, Answers, Votes) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development for Tasks 1–4. Steps use checkbox (`- [ ]`) syntax. **Tasks 5–6 are CONTROLLER-ONLY** (they touch the real PII backup + the cloud project) — a subagent must NOT run them. Subagents must never read `~/Downloads/db_cluster-*.backup`, touch the cloud project, or edit `CLAUDE.md`/`docs/`/`.claude/`/`src_legacy_v0/`.

**Goal:** Restore the remaining old-platform content (83 comments, 133 interests, 5 results→verified answers, 387 likes→upvotes) and ship the new **idea voting feature** (`idea_votes` table + RLS + totals view + minimal UI + sort-by-score).

**Architecture:** One new migration (`idea_votes` + `idea_vote_totals` security-invoker view, RLS mirroring `interest`), new pure transforms + a `buildDocumentV2` emitter in the existing `scripts/etl/` machinery (idea/answer FKs resolved by **scalar subqueries on `legacy_id`** so one artifact works on any environment; comment threading is **two-pass** insert-then-update), and a thin UI layer (VoteControl on the idea page, score on cards, `?sort=top` on `/ideas`). Spec: `docs/superpowers/specs/2026-06-06-etl-restore-v2-design.md`.

**Tech Stack:** TypeScript via `tsx`, `vitest` (synthetic fixtures only), pgTAP, SvelteKit 2 / Svelte 5 runes, supabase-js v2 (RLS does all mutation enforcement — no RPCs).

**Security:** the backup + `scripts/etl/*.generated.sql` contain PII and are gitignored (already covered). The v2 CLI prints **counts only**. Verified source facts (controller probed): perfect referential integrity in all 4 source tables; 0 duplicate interest pairs; all 13 `reply_to` point to lower ids; all 5 results have a link.

---

## Key design decisions
- **FK resolution via scalar subqueries.** v1 minted idea UUIDs at generation time, so v2 emits `(select id from public.ideas where legacy_id = N)` for every idea reference (and `public.answers`/`public.comments` equivalents). Resolved at apply time → the same artifact works on the local rehearsal stack and cloud, stays idempotent, and a missing parent fails loudly (null into a `not null` column). Profile references stay **literal UUIDs** (v1 preserved them). The ref helpers validate `N` is an integer (no string interpolation of dump text into SQL).
- **Comment threading is two-pass.** A multi-row INSERT cannot see its own rows, so pass 1 inserts all comments with `reply_to` omitted; pass 2 emits one idempotent `update … where c.legacy_id = <id> and c.reply_to is null` per reply.
- **Same envelope as v1:** `begin` → `set session_replication_role = replica` → inserts → reply updates → `origin` → `do $$ assert … $$` → `commit`. Conflict handling: `on conflict (legacy_id) do nothing` for comments/answers/artifacts; **targetless `on conflict do nothing` for interest/idea_votes** (they also carry `unique (idea_id, profile_id)` — an organic post-restore row on the same pair must displace the legacy insert, not abort the transaction). The orphan scans in the assert block are the ONLY FK verification — replica mode disables RI triggers and they are never re-validated.
- **Privileged inserts are the point:** the load runs as `postgres` (table owner → bypasses RLS), which is what lets it insert `status='verified'` answers and legacy columns that the client INSERT policies pin shut.
- **Votes:** `value in (-1,1)`, one row per (idea, profile); toggle = DELETE + INSERT (no UPDATE policy, same as `interest`). Old likes import as `value = 1`, weight kept in `legacy`.

## File structure

| File | Responsibility |
|---|---|
| `supabase/migrations/<ts>_idea_votes.sql` | `idea_votes` table + RLS + `idea_vote_totals` view |
| `supabase/tests/database/idea_votes_test.sql` | pgTAP for every policy + the view |
| `scripts/etl/transform.ts` (extend) | `ideaRef`/`answerRef`, `toComment`, `commentReplies`, `toInterest`, `toAnswerFromResult`, `toAnswerArtifact`, `toVote`, `dedupeVotes` |
| `scripts/etl/emit.ts` (extend) | v2 column lists + `buildDocumentV2` |
| `scripts/etl/restore-v2.ts` | CLI: backup → parse → transform → `restore-v2.generated.sql` |
| `src/lib/votes.ts` + `votes.test.ts` | pure score-merge + top-sort helpers |
| `src/lib/components/VoteControl.svelte` | ▲ score ▼ control (form actions + enhance) |
| `src/routes/ideas/[id]/+page.server.ts` (extend) | vote totals + my vote in load; `vote`/`unvote` actions |
| `src/routes/ideas/[id]/+page.svelte` (extend) | mount VoteControl |
| `src/routes/ideas/+page.server.ts` (rewrite load) | `?sort=top` + scores on cards |
| `src/routes/ideas/+page.svelte` (extend) | sort link-nav (mirrors the type filter) |
| `src/lib/components/IdeaCard.svelte` (extend) | optional score chip |

---

## Task 1: `idea_votes` migration + pgTAP

**Files:**
- Create: `supabase/migrations/<generated>_idea_votes.sql` (via `supabase migration new idea_votes` — never invent the filename)
- Create: `supabase/tests/database/idea_votes_test.sql`

- [ ] **Step 1: Create the migration file**

Run: `supabase migration new idea_votes` → note the generated path. Content:

```sql
-- ============ idea_votes (one up/down vote per member per idea; toggle = delete + re-insert) ============
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
alter table public.idea_votes enable row level security;
create index idea_votes_profile_id_idx on public.idea_votes (profile_id);
-- (no separate idea_id index: the unique (idea_id, profile_id) doubles as it — leading column)

-- SELECT: readable when the idea is visible (leverages ideas RLS) OR it is the caller's own vote
create policy "votes readable when idea visible or own" on public.idea_votes for select
  using (
    (select auth.uid()) = profile_id
    or exists (select 1 from public.ideas i where i.id = idea_id)
  );
-- INSERT: a member casts their OWN vote on a visible idea; legacy pinned (service-role-only)
create policy "members vote on visible ideas" on public.idea_votes for insert to authenticated
  with check (
    (select auth.uid()) = profile_id
    and legacy_id is null and legacy = '{}'::jsonb
    and exists (select 1 from public.ideas i where i.id = idea_id)
  );
-- DELETE: a member removes their own vote
create policy "member removes own vote" on public.idea_votes for delete to authenticated
  using ((select auth.uid()) = profile_id);
-- NOTE: no UPDATE policy — switching a vote is delete + re-insert (same toggle pattern as interest).

-- ============ idea_vote_totals (security_invoker: respects the caller's idea visibility) ============
create view public.idea_vote_totals
  with (security_invoker = true) as
  select
    idea_id,
    coalesce(sum(value), 0)::bigint           as score,
    count(*) filter (where value = 1)         as up_count,
    count(*) filter (where value = -1)        as down_count
  from public.idea_votes
  group by idea_id;
grant select on public.idea_vote_totals to anon, authenticated;   -- mirrors bounty_pot (idea_funding migration)
```

(The `value` check lives on the table constraint only — a single deterministic error source; the policy pins identity/visibility/legacy. Accepted product decision: individual votes — including downvotes — are publicly attributable via the API, same as comments.)

- [ ] **Step 2: Write the failing pgTAP test** `supabase/tests/database/idea_votes_test.sql` (conventions per `comments_interest_test.sql`: the `handle_new_user` trigger auto-creates profiles)

```sql
begin;
select plan(14);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','alice@example.com','x', now(), now(), now()),  -- expert author
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','bob@example.com','x', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','dave@example.com','x', now(), now(), now());

insert into public.experts (id, status) values ('11111111-1111-1111-1111-111111111111','approved');
insert into public.ideas (id, author_id, type, title, status) values
  ('a0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','open_ended','Open idea','open'),
  ('a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','open_ended','Draft idea','draft');

set local role authenticated;

-- ===== bob votes (insert pinning) =====
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into public.idea_votes (idea_id, profile_id, value)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',1);
select ok((select count(*) from public.idea_votes) = 1, '1: member upvotes a visible idea');
select throws_ok($$ insert into public.idea_votes (idea_id, profile_id, value)
  values ('a0000000-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444',1) $$,
  '42501', null, '2: cannot vote as another member');
select throws_ok($$ insert into public.idea_votes (idea_id, profile_id, value)
  values ('a0000000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222',1) $$,
  '42501', null, '3: cannot vote on a draft idea you cannot see');
select throws_ok($$ insert into public.idea_votes (idea_id, profile_id, value, legacy_id)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',1,7) $$,
  '42501', null, '4: cannot set legacy_id on a live vote');
select throws_ok($$ insert into public.idea_votes (idea_id, profile_id, value, legacy)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',1,'{"a":1}'::jsonb) $$,
  '42501', null, '5: cannot set a non-empty legacy on a live vote');
select throws_ok($$ insert into public.idea_votes (idea_id, profile_id, value)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',0) $$,
  '23514', null, '6: value must be -1 or 1');
select throws_ok($$ insert into public.idea_votes (idea_id, profile_id, value)
  values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',-1) $$,
  '23505', null, '7: one vote per member per idea (switch = delete + re-insert)');

-- ===== dave downvotes; deletes are own-only =====
set local request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
insert into public.idea_votes (idea_id, profile_id, value)
  values ('a0000000-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444',-1);
select ok((select count(*) from public.idea_votes) = 2, '8: second member downvotes');
delete from public.idea_votes where profile_id = '22222222-2222-2222-2222-222222222222';
select ok((select count(*) from public.idea_votes) = 2, '9: deleting another member''s vote is a no-op');
select results_eq(
  $$ select score, up_count, down_count from public.idea_vote_totals where idea_id = 'a0000000-0000-0000-0000-000000000001' $$,
  $$ values (0::bigint, 1::bigint, 1::bigint) $$,
  '10: totals view aggregates score/up/down');
delete from public.idea_votes where profile_id = '44444444-4444-4444-4444-444444444444';
select ok((select count(*) from public.idea_votes where profile_id = '44444444-4444-4444-4444-444444444444') = 0,
  '11: member removes own vote');

-- ===== draft visibility (author can vote own draft; others see nothing) =====
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
insert into public.idea_votes (idea_id, profile_id, value)
  values ('a0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',1);
select ok((select count(*) from public.idea_votes where idea_id = 'a0000000-0000-0000-0000-000000000002') = 1,
  '12: draft author can vote their own draft');

set local role anon;
-- CRITICAL: clear the stale JWT claims — `set local role` does NOT reset request.jwt.claims, so
-- auth.uid() would still be alice and the own-row SELECT branch would leak her draft vote into
-- test 14. The POLICY is correct; only an uncleared fixture would make it look broken. Do NOT
-- "fix" a red test 14 by weakening the policy or the view.
set local request.jwt.claims = '';
select ok((select count(*) from public.idea_votes where idea_id = 'a0000000-0000-0000-0000-000000000001') = 1,
  '13: anon sees votes on visible ideas');
select ok((select count(*) from public.idea_vote_totals where idea_id = 'a0000000-0000-0000-0000-000000000002') = 0,
  '14: draft votes invisible to anon through the view (security_invoker)');

select * from finish();
rollback;
```

- [ ] **Step 3: Run** `supabase db reset` (applies the migration) then `supabase test db` → expect `idea_votes_test` 15/15 (incl. the UPDATE-is-noop pin, test 8b) plus all existing suites still green (96 + 15 = 111).
- [ ] **Step 4: Regenerate the DB types** (the client is typed — without this every `from('idea_votes')` in Task 4 is a TS error): `supabase gen types typescript --local > src/lib/types/database.ts`, then `npm run check` → 0 errors.
- [ ] **Step 5: Commit** `git add supabase/migrations supabase/tests/database/idea_votes_test.sql src/lib/types/database.ts && git commit -m "feat(votes): idea_votes table + RLS + totals view + pgTAP + types"`

---

## Task 2: v2 transforms

**Files:**
- Modify: `scripts/etl/transform.ts` (append)
- Modify: `scripts/etl/transform.test.ts` (append)

- [ ] **Step 1: Write the failing tests** (append to `scripts/etl/transform.test.ts`)

```ts
import {
  ideaRef, answerRef, toComment, commentReplies, toInterest,
  toAnswerFromResult, toAnswerArtifact, toVote, dedupeVotes
} from './transform';

describe('v2 ref helpers', () => {
  it('emit integer-validated scalar subqueries', () => {
    expect(ideaRef('14')).toBe("(select id from public.ideas where legacy_id = 14)");
    expect(answerRef('3')).toBe("(select id from public.answers where legacy_id = 3)");
    expect(() => ideaRef('14; drop table x')).toThrow();
    expect(() => ideaRef(null)).toThrow();
  });
});

describe('v2 transforms', () => {
  it('toComment maps body/author and keeps reply/anon/upvotes in legacy', () => {
    const c = toComment({ id: '96', created_at: '2022-06-30 06:41:09+00', idea: '16',
      author: '0ab224d1-75b6-44e5-b868-26018ca607fe', text: 'Yes!', reply_to: '69',
      anon_author: null, anon_author_url: null, upvotes: '2' });
    expect(c.legacy_id).toBe("'96'");
    expect(c.idea_id).toBe("(select id from public.ideas where legacy_id = 16)");
    expect(c.author_id).toBe("'0ab224d1-75b6-44e5-b868-26018ca607fe'");
    expect(c.body_md).toBe("'Yes!'");
    expect(c.legacy).toContain('"reply_to":"69"');
    expect(c.legacy).toContain('"upvotes":"2"');
    expect(c.reply_to).toBeUndefined();           // threading is pass-2
  });
  it('toComment keeps empty text as empty string and null author as NULL', () => {
    const c = toComment({ id: '175', created_at: '2023-07-07 15:24:15+00', idea: '242',
      author: null, text: '', reply_to: null, anon_author: null, anon_author_url: null, upvotes: null });
    expect(c.body_md).toBe("''");
    expect(c.author_id).toBe('NULL');
  });
  it('commentReplies returns only rows with reply_to', () => {
    const rows = [
      { id: '96', reply_to: '69' }, { id: '97', reply_to: null }
    ] as any[];
    expect(commentReplies(rows)).toEqual([{ legacy_id: '96', reply_legacy_id: '69' }]);
  });
  it('toInterest maps how→note_md (blank→NULL) and contact flag→legacy', () => {
    const i = toInterest({ id: '14', created_at: '2022-06-14 12:14:29+00',
      user: '3590e5a9-da55-49f8-9d61-726c0b0203fe', idea: '18', contact_if_started: 'f', how: '' });
    expect(i.note_md).toBe('NULL');
    expect(i.profile_id).toBe("'3590e5a9-da55-49f8-9d61-726c0b0203fe'");
    expect(i.legacy).toContain('"contact_if_started":"f"');
  });
  it('toAnswerFromResult maps to a verified answer with a title fallback', () => {
    const titles = new Map([['14', 'Old idea title']]);
    const a = toAnswerFromResult({ id: '3', created_at: '2022-11-21 12:05:13+00', idea: '14',
      user: '0ab224d1-75b6-44e5-b868-26018ca607fe', description: '', image_link: 'http://img',
      type: 'ambiguous', title: '', author: 'COCO, Nina', link: 'http://itch.io/x',
      from_date: '2022-11-13', original: 'f' }, titles);
    expect(a.title).toBe("'Result: Old idea title'");
    expect(a.status).toBe("'verified'");
    expect(a.verified_at).toBe("'2022-11-21 12:05:13+00'");
    expect(a.explanation_md).toBe('NULL');
    expect(a.legacy).toContain('"author":"COCO, Nina"');
  });
  it('toAnswerArtifact emits a url artifact only when link is non-blank', () => {
    const art = toAnswerArtifact({ id: '3', created_at: 'x', link: 'http://itch.io/x' } as any);
    expect(art!.answer_id).toBe("(select id from public.answers where legacy_id = 3)");
    expect(art!.kind).toBe("'url'");
    expect(toAnswerArtifact({ id: '9', created_at: 'x', link: '' } as any)).toBeNull();
  });
  it('toVote maps a like to an upvote, weight in legacy', () => {
    const v = toVote({ id: '7', created_at: '2022-07-01 00:00:00+00',
      user: '0ab224d1-75b6-44e5-b868-26018ca607fe', idea: '14', size: '3' });
    expect(v.value).toBe('1');
    expect(v.legacy).toContain('"size":"3"');
  });
  it('dedupeVotes keeps the earliest per (user, idea)', () => {
    const { kept, dropped } = dedupeVotes([
      { id: '2', created_at: '2022-02-01', user: 'u1', idea: '5', size: '1' },
      { id: '1', created_at: '2022-01-01', user: 'u1', idea: '5', size: '1' },
      { id: '3', created_at: '2022-03-01', user: 'u2', idea: '5', size: '1' }
    ] as any[]);
    expect(kept.map((r: any) => r.id)).toEqual(['1', '3']);
    expect(dropped).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure** `npx vitest run scripts/etl/transform.test.ts` → FAIL (missing exports).

- [ ] **Step 3: Implement** (append to `scripts/etl/transform.ts`)

```ts
// ───────────────────────────── Restore v2 ─────────────────────────────

/** Scalar-subquery ref against a legacy_id anchor. Validates the id is an integer (never interpolate dump text). */
function legacyRef(table: string, legacyId: string | null | undefined): string {
  const n = Number(legacyId);
  if (legacyId == null || !Number.isInteger(n)) throw new Error(`invalid legacy id for ${table}`);
  return `(select id from public.${table} where legacy_id = ${n})`;
}
export const ideaRef = (legacyId: string | null | undefined) => legacyRef('ideas', legacyId);
export const answerRef = (legacyId: string | null | undefined) => legacyRef('answers', legacyId);
export const commentRef = (legacyId: string | null | undefined) => legacyRef('comments', legacyId);

/** old `public.comments` → new `public.comments` (spec §5). reply_to is set in pass 2 (see commentReplies). */
export function toComment(c: Row): SqlRow {
  return {
    legacy_id: lit(c.id),
    idea_id: ideaRef(c.idea),
    author_id: lit(c.author ?? null),
    body_md: lit(c.text ?? ''),                       // empty-text rows are real thread anchors — keep ''
    legacy: jsonbLit({
      reply_to: c.reply_to ?? undefined,
      anon_author: c.anon_author ?? undefined,
      anon_author_url: c.anon_author_url ?? undefined,
      upvotes: c.upvotes ?? undefined
    }),
    created_at: lit(c.created_at ?? { sql: 'now()' })   // explicit NULL would abort on the NOT NULL column
  };
}

/** The (child, parent) legacy-id pairs that need the pass-2 reply_to update. */
export function commentReplies(rows: Row[]): { legacy_id: string; reply_legacy_id: string }[] {
  return rows
    .filter((r) => r.reply_to != null && r.id != null)
    .map((r) => ({ legacy_id: r.id as string, reply_legacy_id: r.reply_to as string }));
}

/** old `idea_user_interest_relation` → `public.interest` (spec §5). */
export function toInterest(r: Row): SqlRow {
  return {
    legacy_id: lit(r.id),
    idea_id: ideaRef(r.idea),
    profile_id: lit(r.user ?? null),
    note_md: lit(nullifBlank(r.how)),
    legacy: jsonbLit({ contact_if_started: r.contact_if_started ?? undefined }),
    created_at: lit(r.created_at ?? { sql: 'now()' })
  };
}

/** old `results` → `public.answers` as verified historical outputs (spec §5). `titles` = old idea id → title. */
export function toAnswerFromResult(r: Row, titles: Map<string, string>): SqlRow {
  const title = nullifBlank(r.title) ?? `Result: ${(r.idea != null && titles.get(r.idea)) || 'untitled idea'}`;
  return {
    legacy_id: lit(r.id),
    idea_id: ideaRef(r.idea),
    submitter_id: lit(r.user ?? null),
    title: lit(title),
    explanation_md: lit(nullifBlank(r.description)),
    status: lit('verified'),
    verified_at: lit(r.created_at ?? null),           // old table names no verifier; verified_by stays NULL
    legacy: jsonbLit({
      author: r.author ?? undefined,
      image_link: nullifBlank(r.image_link) ?? undefined,
      type: r.type ?? undefined,
      link: nullifBlank(r.link) ?? undefined,
      from_date: r.from_date ?? undefined,
      original: r.original ?? undefined
    }),
    created_at: lit(r.created_at ?? { sql: 'now()' })
  };
}

/** One `answer_artifacts` row per result with a non-blank link; null otherwise. */
export function toAnswerArtifact(r: Row): SqlRow | null {
  const url = nullifBlank(r.link);
  if (!url) return null;
  return {
    legacy_id: lit(r.id),
    answer_id: answerRef(r.id),
    kind: lit('url'),
    url: lit(url),
    created_at: lit(r.created_at ?? { sql: 'now()' })
  };
}

/** old `idea_user_likes` → `public.idea_votes` as upvotes; old weight kept in legacy (spec §5). */
export function toVote(l: Row): SqlRow {
  return {
    legacy_id: lit(l.id),
    idea_id: ideaRef(l.idea),
    profile_id: lit(l.user ?? null),
    value: '1',
    legacy: jsonbLit({ size: l.size ?? undefined }),
    created_at: lit(l.created_at ?? { sql: 'now()' })
  };
}

/** Guard for `unique (idea_id, profile_id)`: keep the earliest like per (user, idea). */
export function dedupeVotes(rows: Row[]): { kept: Row[]; dropped: number } {
  const sorted = [...rows].sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));
  const seen = new Set<string>();
  const kept: Row[] = [];
  for (const r of sorted) {
    const key = `${r.user}|${r.idea}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(r);
  }
  return { kept, dropped: rows.length - kept.length };
}
```

- [ ] **Step 4: Run** `npx vitest run scripts/etl/transform.test.ts` → PASS (all v1 tests must stay green).
- [ ] **Step 5: Commit** `git add scripts/etl/transform.ts scripts/etl/transform.test.ts && git commit -m "feat(etl): v2 transforms (comments/interest/answers/votes) with legacy-ref subqueries"`

---

## Task 3: v2 emitter + CLI

**Files:**
- Modify: `scripts/etl/emit.ts` (append)
- Modify: `scripts/etl/emit.test.ts` (append)
- Create: `scripts/etl/restore-v2.ts`
- Modify: `package.json` (add script)

- [ ] **Step 1: Write the failing tests** (append to `scripts/etl/emit.test.ts`)

```ts
import { buildDocumentV2 } from './emit';

describe('buildDocumentV2', () => {
  const data = {
    comments: [{ legacy_id: "'96'" }],
    replies: [{ legacy_id: '96', reply_legacy_id: '69' }],
    interest: [{ legacy_id: "'14'" }],
    answers: [{ legacy_id: "'3'" }],
    artifacts: [{ legacy_id: "'3'" }],
    votes: [{ legacy_id: "'7'" }]
  } as any;

  it('wraps in a transaction with the replica bracket and ends with assertions', () => {
    const doc = buildDocumentV2(data);
    expect(doc.startsWith('begin;')).toBe(true);
    expect(doc).toContain('set session_replication_role = replica;');
    expect(doc).toContain('set session_replication_role = origin;');
    expect(doc).toMatch(/do \$\$[\s\S]*assert[\s\S]*\$\$/);
    expect(doc).toContain('orphan comment author');
    expect(doc).toContain('orphan reply_to');
    expect(doc.trim().endsWith('commit;')).toBe(true);
  });

  it('orders inserts comments → replies-update → interest → answers → artifacts → votes', () => {
    const doc = buildDocumentV2(data);
    const order = [
      'insert into public.comments',
      'update public.comments',
      'insert into public.interest',
      'insert into public.answers',
      'insert into public.answer_artifacts',
      'insert into public.idea_votes'
    ].map((s) => doc.indexOf(s));
    expect(order.every((n) => n >= 0)).toBe(true);
    for (let k = 1; k < order.length; k++) expect(order[k - 1]).toBeLessThan(order[k]);
  });

  it('emits idempotent reply updates guarded by "reply_to is null"', () => {
    const doc = buildDocumentV2(data);
    expect(doc).toContain(
      'update public.comments c set reply_to = (select p.id from public.comments p where p.legacy_id = 69)\n' +
      'where c.legacy_id = 96 and c.reply_to is null;'
    );
  });

  it('arbitrates ALL unique constraints on interest/votes (targetless) and legacy_id elsewhere', () => {
    const doc = buildDocumentV2(data);
    const seg = (from: string, to: string) => doc.slice(doc.indexOf(from), doc.indexOf(to));
    // comments/answers/artifacts: legacy_id is their only unique key
    expect(seg('insert into public.comments', 'update public.comments')).toContain('on conflict (legacy_id) do nothing;');
    // interest/idea_votes ALSO carry unique (idea_id, profile_id): an organic post-restore row on the
    // same pair must NOT abort the load — a targetless `on conflict do nothing` arbitrates ANY unique index
    expect(seg('insert into public.interest', 'insert into public.answers')).toContain('on conflict do nothing;');
    expect(seg('insert into public.interest', 'insert into public.answers')).not.toContain('on conflict (');
    expect(seg('insert into public.idea_votes', 'set session_replication_role = origin')).toContain('on conflict do nothing;');
    expect(seg('insert into public.idea_votes', 'set session_replication_role = origin')).not.toContain('on conflict (');
  });

  it('asserts legacy-scoped counts where exact, totals where displacement is possible', () => {
    const doc = buildDocumentV2(data);
    // comments/answers/artifacts can't be displaced → exact legacy-scoped counts (organic-immune)
    expect(doc).toMatch(/assert \(select count\(\*\) from public\.comments where legacy_id is not null\) >= \d+/);
    expect(doc).toMatch(/assert \(select count\(\*\) from public\.answers where legacy_id is not null\) >= \d+/);
    // interest/votes: an organic row on the same (idea_id, profile_id) DISPLACES the legacy insert,
    // so legacy-scoped counts could undershoot — assert totals (legacy + displacing organic ≥ source)
    expect(doc).toMatch(/assert \(select count\(\*\) from public\.idea_votes\) >= \d+/);
    expect(doc).toMatch(/assert \(select count\(\*\) from public\.interest\) >= \d+/);
    expect(doc).toContain('orphan comment idea');   // full spec §5 orphan-scan list
    expect(doc).toContain('orphan artifact answer');
  });
});
```

- [ ] **Step 2: Run to verify failure** `npx vitest run scripts/etl/emit.test.ts` → FAIL (`buildDocumentV2` missing).

- [ ] **Step 3a: Extend `insertRows` for targetless conflicts.** In `scripts/etl/sql.ts`, make the conflict target optional — an empty/omitted target emits a targetless `on conflict do nothing` (arbitrates ANY unique index):

```ts
export function insertRows(
  table: string, columns: string[], rows: Record<string, string>[], conflictTarget?: string
): string {
  if (rows.length === 0) return '';
  const tuples = rows.map((r) => `  (${columns.map((c) => r[c] ?? 'NULL').join(', ')})`).join(',\n');
  const conflict = conflictTarget ? `on conflict (${conflictTarget}) do nothing;` : 'on conflict do nothing;';
  return `insert into ${table} (${columns.join(', ')}) values\n${tuples}\n${conflict}\n`;
}
```

Append to `scripts/etl/sql.test.ts`:

```ts
  it('insertRows() omits the conflict target when none is given (arbitrates any unique index)', () => {
    const sql = insertRows('public.t', ['id'], [{ id: lit('1') }]);
    expect(sql.trim().endsWith('on conflict do nothing;')).toBe(true);
  });
```

(All v1 call sites pass a target — behavior unchanged; `npx vitest run scripts/etl/sql.test.ts` must stay green.)

- [ ] **Step 3b: Implement** (append to `scripts/etl/emit.ts`)

```ts
/** v2 target column lists (only columns the ETL sets; defaults cover the rest). */
export const COMMENTS_COLUMNS = ['legacy_id', 'idea_id', 'author_id', 'body_md', 'legacy', 'created_at'] as const;
export const INTEREST_COLUMNS = ['legacy_id', 'idea_id', 'profile_id', 'note_md', 'legacy', 'created_at'] as const;
export const ANSWERS_COLUMNS = ['legacy_id', 'idea_id', 'submitter_id', 'title', 'explanation_md', 'status', 'verified_at', 'legacy', 'created_at'] as const;
export const ARTIFACTS_COLUMNS = ['legacy_id', 'answer_id', 'kind', 'url', 'created_at'] as const;
export const VOTES_COLUMNS = ['legacy_id', 'idea_id', 'profile_id', 'value', 'legacy', 'created_at'] as const;

export type EmitDataV2 = {
  comments: SqlRow[];
  replies: { legacy_id: string; reply_legacy_id: string }[];
  interest: SqlRow[];
  answers: SqlRow[];
  artifacts: SqlRow[];
  votes: SqlRow[];
};

/**
 * Restore-v2 document (spec §4): begin → replica → comments → reply updates → interest → answers
 * → artifacts → idea_votes → origin → count + orphan assertions → commit. Idempotent throughout
 * (`on conflict (legacy_id) do nothing`; reply updates guarded by `reply_to is null`).
 * Idea/answer FKs are scalar subqueries on legacy_id, resolved at apply time (see transform.ts refs).
 */
export function buildDocumentV2(data: EmitDataV2): string {
  const parts: string[] = [];
  parts.push('begin;');
  parts.push('set session_replication_role = replica;');

  parts.push(insertRows('public.comments', [...COMMENTS_COLUMNS], data.comments, 'legacy_id'));
  parts.push(
    data.replies
      .map((r) => {
        const child = Number(r.legacy_id);
        const parent = Number(r.reply_legacy_id);
        if (!Number.isInteger(child) || !Number.isInteger(parent)) throw new Error('invalid reply pair');
        return (
          `update public.comments c set reply_to = (select p.id from public.comments p where p.legacy_id = ${parent})\n` +
          `where c.legacy_id = ${child} and c.reply_to is null;`
        );
      })
      .join('\n')
  );
  // interest + idea_votes ALSO carry unique (idea_id, profile_id): an organic post-restore row on the
  // same pair must DISPLACE the legacy insert, not abort the transaction → targetless on conflict.
  parts.push(insertRows('public.interest', [...INTEREST_COLUMNS], data.interest));
  parts.push(insertRows('public.answers', [...ANSWERS_COLUMNS], data.answers, 'legacy_id'));
  parts.push(insertRows('public.answer_artifacts', [...ARTIFACTS_COLUMNS], data.artifacts, 'legacy_id'));
  parts.push(insertRows('public.idea_votes', [...VOTES_COLUMNS], data.votes));

  parts.push('set session_replication_role = origin;');

  // VERIFICATION IS HERE OR NOWHERE: replica mode DISABLES the RI triggers and restoring `origin`
  // never re-validates rows — these scans are the only FK-integrity check for the load.
  // Counts: comments/answers/artifacts can't be displaced → exact legacy-scoped; interest/votes can be
  // displaced by an organic (idea_id, profile_id) row → assert totals (legacy + displacing organic).
  parts.push(
    [
      'do $$ begin',
      "  assert (select count(*) from public.comments where legacy_id is not null) >= 83, 'comments count too low';",
      "  assert (select count(*) from public.interest) >= 133, 'interest count too low';",
      "  assert (select count(*) from public.answers where legacy_id is not null) >= 5, 'answers count too low';",
      "  assert (select count(*) from public.answer_artifacts where legacy_id is not null) >= 5, 'artifacts count too low';",
      "  assert (select count(*) from public.idea_votes) >= 387, 'votes count too low';",
      "  assert (select count(*) from public.comments where legacy_id is not null and reply_to is not null) >= 13, 'reply links too low';",
      '  assert (select count(*) from public.comments c left join public.profiles p on p.id = c.author_id',
      "          where c.author_id is not null and p.id is null) = 0, 'orphan comment author';",
      '  assert (select count(*) from public.comments c left join public.ideas i on i.id = c.idea_id',
      "          where i.id is null) = 0, 'orphan comment idea';",
      '  assert (select count(*) from public.comments c left join public.comments p on p.id = c.reply_to',
      "          where c.reply_to is not null and p.id is null) = 0, 'orphan reply_to';",
      '  assert (select count(*) from public.interest x left join public.profiles p on p.id = x.profile_id',
      "          where x.profile_id is not null and p.id is null) = 0, 'orphan interest profile';",
      '  assert (select count(*) from public.interest x left join public.ideas i on i.id = x.idea_id',
      "          where i.id is null) = 0, 'orphan interest idea';",
      '  assert (select count(*) from public.answers a left join public.profiles p on p.id = a.submitter_id',
      "          where a.submitter_id is not null and p.id is null) = 0, 'orphan answer submitter';",
      '  assert (select count(*) from public.answers a left join public.ideas i on i.id = a.idea_id',
      "          where i.id is null) = 0, 'orphan answer idea';",
      '  assert (select count(*) from public.answer_artifacts t left join public.answers a on a.id = t.answer_id',
      "          where a.id is null) = 0, 'orphan artifact answer';",
      '  assert (select count(*) from public.idea_votes v left join public.profiles p on p.id = v.profile_id',
      "          where p.id is null) = 0, 'orphan vote profile';",
      '  assert (select count(*) from public.idea_votes v left join public.ideas i on i.id = v.idea_id',
      "          where i.id is null) = 0, 'orphan vote idea';",
      'end $$;'
    ].join('\n')
  );

  parts.push('commit;');
  return parts.filter((p) => p.trim() !== '').join('\n\n') + '\n';
}
```

- [ ] **Step 4: Implement the CLI** `scripts/etl/restore-v2.ts`

```ts
/**
 * Restore-v2 CLI — comments / interest / results→answers(+artifacts) / likes→votes.
 * Prints COUNTS only (never row contents) — backup + generated SQL contain PII (gitignored).
 *
 * Usage: `npm run etl:restore-v2 [path/to/backup]`
 * (Controller-only against the real backup; subagents use synthetic fixtures.)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseCopyBlock } from './parse-dump';
import * as t from './transform';
import { buildDocumentV2 } from './emit';

const BACKUP = process.argv[2] ?? `${process.env.HOME}/Downloads/db_cluster-16-10-2025@02-48-41.backup`;
const OUT = new URL('./restore-v2.generated.sql', import.meta.url).pathname;

function main() {
  const dump = readFileSync(BACKUP, 'utf8');

  const commentsRaw = parseCopyBlock(dump, 'public.comments').rows;
  const interestRaw = parseCopyBlock(dump, 'public.idea_user_interest_relation').rows;
  const resultsRaw = parseCopyBlock(dump, 'public.results').rows;
  const likesRaw = parseCopyBlock(dump, 'public.idea_user_likes').rows;
  const ideasRaw = parseCopyBlock(dump, 'public.ideas').rows;   // only for the answer-title fallback

  const titles = new Map<string, string>();
  for (const i of ideasRaw) if (i.id && i.title) titles.set(i.id, i.title);

  const comments = commentsRaw.map((c) => t.toComment(c));
  const replies = t.commentReplies(commentsRaw);
  const interest = interestRaw.map((r) => t.toInterest(r));
  const answers = resultsRaw.map((r) => t.toAnswerFromResult(r, titles));
  const artifacts = resultsRaw.map((r) => t.toAnswerArtifact(r)).filter((a): a is NonNullable<typeof a> => a !== null);
  const { kept, dropped } = t.dedupeVotes(likesRaw);
  const votes = kept.map((l) => t.toVote(l));

  writeFileSync(OUT, buildDocumentV2({ comments, replies, interest, answers, artifacts, votes }), 'utf8');

  // COUNTS ONLY — never row contents (PII discipline).
  console.log(
    `wrote ${OUT}: comments=${comments.length} replies=${replies.length} interest=${interest.length} ` +
      `answers=${answers.length} artifacts=${artifacts.length} votes=${votes.length} (deduped ${dropped})`
  );
}

main();
```

In `package.json` `scripts` add: `"etl:restore-v2": "tsx scripts/etl/restore-v2.ts"`.

- [ ] **Step 5: Run** `npx vitest run scripts/etl` → all green (v1 + v2). `npm run check` → 0 errors.
- [ ] **Step 6: Commit** `git add scripts/etl/sql.ts scripts/etl/sql.test.ts scripts/etl/emit.ts scripts/etl/emit.test.ts scripts/etl/restore-v2.ts package.json && git commit -m "feat(etl): v2 emitter + restore-v2 CLI"`

---

## Task 4: Vote UI + sort-by-score

**Files:**
- Create: `src/lib/votes.ts`, `src/lib/votes.test.ts`, `src/lib/components/VoteControl.svelte`
- Modify: `src/lib/components/IdeaCard.svelte`, `src/routes/ideas/+page.server.ts`, `src/routes/ideas/+page.svelte`, `src/routes/ideas/[id]/+page.server.ts`, `src/routes/ideas/[id]/+page.svelte`

- [ ] **Step 1: Write the failing test** `src/lib/votes.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { attachScores, sortTop } from './votes';

describe('votes helpers', () => {
  it('attachScores joins totals onto ideas, defaulting 0', () => {
    const out = attachScores(
      [{ id: 'a' }, { id: 'b' }],
      [{ idea_id: 'b', score: 5 }]
    );
    expect(out).toEqual([{ id: 'a', score: 0 }, { id: 'b', score: 5 }]);
  });
  it('sortTop orders by score desc, then created_at desc', () => {
    const out = sortTop([
      { id: 'a', score: 1, created_at: '2024-01-01' },
      { id: 'b', score: 5, created_at: '2023-01-01' },
      { id: 'c', score: 1, created_at: '2025-01-01' }
    ]);
    expect(out.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });
});
```

- [ ] **Step 2: Implement** `src/lib/votes.ts`

```ts
export type VoteTotal = { idea_id: string; score: number };

/** Join vote totals onto idea rows; ideas without votes get score 0 (the view omits them). */
export function attachScores<T extends { id: string }>(
  ideas: T[],
  totals: VoteTotal[]
): (T & { score: number })[] {
  const byIdea = new Map(totals.map((t) => [t.idea_id, t.score]));
  return ideas.map((i) => ({ ...i, score: byIdea.get(i.id) ?? 0 }));
}

/** Score desc, ties broken by created_at desc. */
export function sortTop<T extends { score: number; created_at?: string | null }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => b.score - a.score || String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
  );
}
```

Run `npx vitest run src/lib/votes.test.ts` → PASS.

- [ ] **Step 3: VoteControl component** `src/lib/components/VoteControl.svelte`

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  let { score, myVote, canVote, signinHref }: {
    score: number; myVote: 1 | -1 | null; canVote: boolean; signinHref?: string;
  } = $props();

  // Optimistic local view (spec §6): apply the expected outcome immediately, reconcile when the
  // action's load re-run delivers fresh props (the $effect clears the override on every prop change).
  let pending = $state(false);
  let optimistic = $state<{ score: number; myVote: 1 | -1 | null } | null>(null);
  $effect(() => { void score; void myVote; optimistic = null; });
  const view = $derived(optimistic ?? { score, myVote });

  const submit = (value: 1 | -1) => () => {
    const cur = view;
    optimistic = cur.myVote === value
      ? { score: cur.score - value, myVote: null }                        // same arrow → unvote
      : { score: cur.score + value - (cur.myVote ?? 0), myVote: value };  // vote / switch
    pending = true;
    return async ({ update }: { update: () => Promise<void> }) => {
      await update();           // re-runs the load → fresh score/myVote → $effect clears optimistic
      pending = false;
    };
  };
</script>
<div class="flex items-center gap-1.5 rounded-xl border px-2 py-1"
     style="border-color:var(--line); background:var(--surface)">
  {#if !canVote && signinHref}
    <a href={signinHref} class="px-1" aria-label="Sign in to vote" style="color:var(--muted)">▲</a>
    <span class="min-w-5 text-center text-sm font-semibold tabular-nums" style="color:var(--ink)">{view.score}</span>
    <a href={signinHref} class="px-1" aria-label="Sign in to vote" style="color:var(--muted)">▼</a>
  {:else}
    <form method="POST" action={view.myVote === 1 ? '?/unvote' : '?/vote'} use:enhance={submit(1)}>
      <input type="hidden" name="value" value="1" />
      <button class="px-1 transition disabled:opacity-40" disabled={!canVote || pending} aria-label="Upvote"
              aria-pressed={view.myVote === 1}
              style="color:{view.myVote === 1 ? 'var(--green-deep)' : 'var(--muted)'}">▲</button>
    </form>
    <span class="min-w-5 text-center text-sm font-semibold tabular-nums" style="color:var(--ink)">{view.score}</span>
    <form method="POST" action={view.myVote === -1 ? '?/unvote' : '?/vote'} use:enhance={submit(-1)}>
      <input type="hidden" name="value" value="-1" />
      <button class="px-1 transition disabled:opacity-40" disabled={!canVote || pending} aria-label="Downvote"
              aria-pressed={view.myVote === -1}
              style="color:{view.myVote === -1 ? 'var(--neg)' : 'var(--muted)'}">▼</button>
    </form>
  {/if}
</div>
```

(Active upvote = `--green-deep` small mark; active downvote = `--neg`, the semantic negative. The optimistic override + `pending` guard satisfy spec §6 — instant feedback, no double-submit; the load re-run reconciles to server truth. Signed-out users get the arrows as links to `signinHref` — there is no pre-existing `?next=` sign-in link on the idea page, so the control carries its own.)

- [ ] **Step 4: Idea detail — load + actions.** In `src/routes/ideas/[id]/+page.server.ts`:

To the `load`, after the interest block, add:

```ts
  // votes: totals + the caller's own vote
  const { data: voteTotals } = await supabase
    .from('idea_vote_totals').select('score').eq('idea_id', idea.id).maybeSingle();
  let myVote: 1 | -1 | null = null;
  if (user) {
    const { data: mv } = await supabase
      .from('idea_votes').select('value').eq('idea_id', idea.id).eq('profile_id', user.id).maybeSingle();
    myVote = (mv?.value as 1 | -1 | undefined) ?? null;
  }
```

and to the returned object add: `score: voteTotals?.score ?? 0, myVote,`.

To `actions` add:

```ts
  vote: async ({ request, params, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in to vote' });
    const fd = await request.formData();
    const value = Number(fd.get('value'));
    if (value !== 1 && value !== -1) return fail(400, { message: 'Invalid vote' });
    // switch = delete own row first (no UPDATE policy), then insert; a 23505 race means a vote
    // already landed — treat as ok (the page re-load shows the truth)
    await supabase.from('idea_votes').delete().eq('idea_id', params.id).eq('profile_id', user.id);
    const { error: e } = await supabase.from('idea_votes').insert({
      idea_id: params.id, profile_id: user.id, value
    });
    if (e && (e as { code?: string }).code !== '23505') return fail(400, { message: e.message });
    return { ok: true };
  },

  unvote: async ({ params, locals: { supabase, safeGetSession } }) => {
    const { user } = await safeGetSession();
    if (!user) return fail(401, { message: 'Sign in' });
    const { error: e } = await supabase.from('idea_votes')
      .delete().eq('idea_id', params.id).eq('profile_id', user.id);
    if (e) return fail(400, { message: e.message });
    return { ok: true };
  },
```

- [ ] **Step 5: Mount the control.** In `src/routes/ideas/[id]/+page.svelte`, import `VoteControl` and render it in the header row next to the title/status:

```svelte
<VoteControl score={data.score} myVote={data.myVote} canVote={data.canEngage}
             signinHref={`/login?next=/ideas/${data.idea.id}`} />
```

(Match the file's existing header layout — place it inside the same flex row as the `StatusBadge`.)

- [ ] **Step 6: Browse page — sort + scores.** Replace `src/routes/ideas/+page.server.ts` with:

```ts
import type { PageServerLoad } from './$types';
import { attachScores, sortTop } from '$lib/votes';

const PAGE = 24;
export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
  const type = url.searchParams.get('type');       // 'hypothesis' | 'open_ended' | null
  const sort = url.searchParams.get('sort') === 'top' ? 'top' : 'new';
  const page = Math.max(0, Number(url.searchParams.get('page') ?? 0));

  // vote totals are small (≤ #ideas rows; ~240 today, well under PostgREST's 1000-row cap — revisit
  // both whole-set fetches if the idea count ever approaches 1000) — fetched once for the card scores
  const { data: totals } = await supabase.from('idea_vote_totals').select('idea_id, score');

  let base = supabase
    .from('ideas')
    .select('id, title, summary_md, type, status, created_at', { count: 'exact' })
    .neq('status', 'draft');
  if (type === 'hypothesis' || type === 'open_ended') base = base.eq('type', type);

  if (sort === 'top') {
    // global sort by score needs the whole (small) set; slice the page in memory
    const { data: all } = await base.order('created_at', { ascending: false });
    const ranked = sortTop(attachScores(all ?? [], totals ?? []));
    return {
      ideas: ranked.slice(page * PAGE, (page + 1) * PAGE),
      count: ranked.length, page, pageSize: PAGE, type, sort
    };
  }

  const { data: ideas, count } = await base
    .order('created_at', { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  return {
    ideas: attachScores(ideas ?? [], totals ?? []),
    count: count ?? 0, page, pageSize: PAGE, type, sort
  };
};
```

- [ ] **Step 7: Browse page markup.** In `src/routes/ideas/+page.svelte`, add a sort nav under the type nav (mirroring its link pattern), and thread `sort` through the pagination links:

```svelte
<nav class="mb-6 -mt-4 flex gap-2 text-sm">
  <a href="/ideas{data.type ? `?type=${data.type}` : ''}"
     style="color:{data.sort === 'top' ? 'var(--muted)' : 'var(--green-deep)'}">Newest</a>
  <a href="/ideas?{data.type ? `type=${data.type}&` : ''}sort=top"
     style="color:{data.sort === 'top' ? 'var(--green-deep)' : 'var(--muted)'}">Top</a>
</nav>
```

Pagination hrefs become `/ideas?{data.type ? `type=${data.type}&` : ''}{data.sort === 'top' ? 'sort=top&' : ''}page={…}`.

In `src/lib/components/IdeaCard.svelte`, extend the prop type with `score?: number` and add next to the `StatusBadge`:

```svelte
{#if typeof idea.score === 'number'}
  <span class="text-xs font-semibold tabular-nums" style="color:var(--muted)">▲ {idea.score}</span>
{/if}
```

- [ ] **Step 8: Update the browse-load test.** `src/routes/ideas/ideas.test.ts`'s `mkLocals` must now serve two queries (`idea_vote_totals` and `ideas`). Replace the file with:

```ts
import { describe, it, expect } from 'vitest';
import { load } from './+page.server';

function mkLocals(rows: unknown[], totals: unknown[] = []) {
  const make = (table: string): any => {
    if (table === 'idea_vote_totals') return { select: () => Promise.resolve({ data: totals }) };
    // thenable builder: serves both `…order().range()` (new) and a directly-awaited `…order()` (top)
    const result = { data: rows, count: rows.length };
    const builder: any = {
      select() { return this; }, neq() { return this; }, eq() { return this; }, order() { return this; },
      range() { return Promise.resolve(result); },
      then(resolve: any, reject: any) { return Promise.resolve(result).then(resolve, reject); }
    };
    return builder;
  };
  return { supabase: { from: (t: string) => make(t) } } as any;
}

describe('ideas browse load', () => {
  it('returns ideas + count with scores attached', async () => {
    const res = (await load({
      url: new URL('http://x/ideas'),
      locals: mkLocals([{ id: '1', title: 'A' }], [{ idea_id: '1', score: 3 }])
    } as any)) as any;
    expect(res.ideas).toEqual([{ id: '1', title: 'A', score: 3 }]);
    expect(res.count).toBe(1);
  });
  it('sort=top ranks by score desc', async () => {
    const res = (await load({
      url: new URL('http://x/ideas?sort=top'),
      locals: mkLocals(
        [{ id: '1', created_at: '2024-01-02' }, { id: '2', created_at: '2024-01-01' }],
        [{ idea_id: '2', score: 9 }]
      )
    } as any)) as any;
    expect(res.ideas.map((i: any) => i.id)).toEqual(['2', '1']);
  });
});
```

Note for the implementer: the `order()` mock above resolves the promise (the real builder is thenable after `.order()` when no `.range()` follows); make the mock match however the final query chain is written — the assertion targets are the returned `ideas`/`count`, not the mock's shape.

- [ ] **Step 9: Run everything.** `npm run check` → 0 errors; `npx vitest run` → all green; `npm run build` → succeeds.
- [ ] **Step 10: Commit** `git add -A -- src && git commit -m "feat(votes): VoteControl + idea-page voting + /ideas scores & sort-by-top"`

---

## Task 5 (CONTROLLER ONLY — real PII backup, local): rehearse

> A subagent must NOT do this — it reads the real backup. The controller runs it.

- [ ] Generate: `npm run etl:restore-v2` → expect `comments=83 replies=13 interest=133 answers=5 artifacts=5 votes=387 (deduped 0)`.
- [ ] Fresh local stack: `supabase db reset` (applies the `idea_votes` migration), then apply **v1 first** (its artifact still exists; regenerate with `npm run etl:restore-v1` if not), then v2 — both via
  `docker exec -i supabase_db_aisafetyideas psql -U postgres -d postgres -v ON_ERROR_STOP=1 < scripts/etl/restore-v<N>.generated.sql > /tmp/restore-v<N>.log 2>&1; echo exit=$?` (capture the exit code directly — never pipe psql into `tail`).
- [ ] Verify locally:
  - counts: comments 83 / interest 133 / answers 5 / artifacts 5 / votes 387; `reply_to` set on 13 comments.
  - orphan scans (same queries as the embedded asserts) → all 0.
  - spot-check: a threaded comment resolves its parent; an idea's score in `idea_vote_totals` matches its old like count; a verified answer shows on its idea page with its artifact link.
  - idempotency: re-apply the v2 artifact → `INSERT 0 0` everywhere, `UPDATE 0`, counts unchanged.
  - UI: `npm run dev` → `/ideas?sort=top` ranks restored ideas by score; idea page shows VoteControl + restored comments/answers.
- [ ] Confirm `git status` shows `restore-v2.generated.sql` ignored. Do not commit it.

---

## Task 6 (CONTROLLER ONLY — cloud + PII): load to cloud

> Controller-only. Subagents never touch cloud.

- [ ] **PR merged first** (the deployed app must already have the vote UI + the repo the migration file), then apply the `idea_votes` migration to `gjomchhbsbtauzkpyjwa` via MCP `apply_migration`.
- [ ] **Checkpoint with the owner** (a fresh PAT is needed — the v1 token was revoked), then apply the rehearsed artifact via the Management API over 443 (psql ports are blocked on the owner's network; the artifact must NOT stream through MCP `execute_sql`). Keep the PAT out of argv/history: have the owner paste it into a `chmod 600` temp file, then:

```bash
jq -Rs '{query: .}' scripts/etl/restore-v2.generated.sql | curl -sS -m 600 \
  -X POST "https://api.supabase.com/v1/projects/gjomchhbsbtauzkpyjwa/database/query" \
  -H @<(printf 'Authorization: Bearer %s\n' "$(cat /tmp/sb-pat)") -H "Content-Type: application/json" \
  --data-binary @- -o /tmp/restore-v2-response.json -w "http=%{http_code}\n"
```

  **Treat anything other than `http=201` as failure** (the transaction rolled back — read the response body; do not retry blindly). Delete `/tmp/sb-pat` immediately after.
- [ ] Verify on cloud (MCP `execute_sql`), organic-data-immune: `count(*) … where legacy_id is not null` per table → expect exactly **83 comments / 5 answers / 5 artifacts**, reply_to set on 13 legacy comments, and `interest`/`idea_votes` legacy counts + displaced pairs summing to **133 / 387** (displaced = organic rows sharing an (idea_id, profile_id) pair with a skipped legacy row — normally 0 this soon after launch). Then the orphan scans → all 0.
- [ ] Re-run `get_advisors` (security + performance) — expect the accepted baseline only (`idea_vote_totals` is security_invoker; both new FKs are indexed).
- [ ] Smoke test on the deployed app: `/ideas?sort=top`, a restored comment thread, a verified answer, casting + removing a vote.
- [ ] Remind the owner to **revoke the PAT** (and rotate the DB password if not already done after v1).
- [ ] Update project memory: Restore v2 complete (counts) — the old-platform restore is DONE; remaining: post-ETL polish (rate-limiting, verify→payout animation, fuller E2E).

---

## Done-when (Restore v2 acceptance)
- `supabase test db` green incl. `idea_votes_test` 15/15 (111 total); `npx vitest run` green (etl + votes + browse); `npm run check` 0 errors; `npm run build` succeeds.
- `npm run etl:restore-v2` deterministically emits a gitignored artifact (83/13/133/5/5/387 printed).
- Local rehearsal: embedded asserts pass, orphan scans 0, threading resolved, idempotent re-run, UI shows scores/sort/votes/comments/answers.
- Cloud: counts verified, advisors at baseline, smoke test passes, PAT revoked.
- No PII committed; CLI logs counts only.
