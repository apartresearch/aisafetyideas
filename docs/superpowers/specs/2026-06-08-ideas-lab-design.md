# Ideas Lab — Design Spec

> **Status:** Approved for planning (2026-06-08). Single PR. Builds on the redesigned public
> face (PR #62) and the submission-gating work started on `feat-open-submissions`.

## 1. Overview

A personal **Ideas Lab** in the dashboard: capture research ideas at notes-app speed, then
incubate each one through an AI-powered **critique ↔ refine loop**, distill it into an
**ExecPlan** + a **readable plan**, and hand both off to an agent — or publish the idea to the
platform. Each draft behaves like a to-do with expandable tools.

**The cool part:** simulated peer review. You write a rough idea; a panel of AI "reviewers"
(skeptic, methods, impact, clarifying questions) pokes holes and asks questions; you refine;
re-run; the idea visibly levels up each pass. When it's tight, generate the plans and ship them
to an agent that builds the paper.

## 2. Goals / Non-goals

**Goals**
- Add a draft in < 1s, perceived-instant (optimistic), synced (not browser-local).
- Each draft is a real `ideas` row in `draft` status (real slug, private to the author).
- A uniform, extensible per-draft **expansion registry** so new tools drop in cleanly.
- AI critique↔refine loop with stored rounds; ExecPlan + readable-plan generation; copy-to-agent.
- "Make it a full idea" → publish through existing submission gating.
- AI features gated to **approved experts · admins · active monthly supporters**, rate-limited.

**Non-goals (this PR)**
- Real recurring billing / Stripe subscriptions (Phase 2). The supporter flag exists; it's
  populated by an admin for now and by billing later.
- GitHub repo scaffolding, venue/conference discovery, "link up agents" — registered as
  visible **"coming soon"** tools to prove extensibility; not implemented.
- Streaming token UI (responses render on completion; streaming is a later polish).

## 3. Data model & migrations

A single migration `add_ideas_lab` extending the in-progress `open_idea_submissions` work:

**`ideas` table**
- `expansions jsonb not null default '{}'` — per-draft tool output, keyed by tool:
  - `agent_prompt`: `{ text, at }`
  - `critiques`: `[ { round, at, reviewers: [{ persona, comments[], questions[] }] } ]`
  - `exec_plan_md`: `{ md, at }`
  - `readable_plan_md`: `{ md, at }`
  Published ideas simply carry whatever they had; the field is harmless there.

**`profiles` table**
- `supporter_until timestamptz` — null = not a supporter; a future timestamp = active monthly
  supporter. Set by admin today; by billing in Phase 2. (No new RLS; profiles already
  readable; only admin/self/ billing may update — covered by existing update policy + admin.)

**Submission gating (extends `enforce_idea_submission`)**
- *INSERT:* if `new.status = 'draft'` → leave as draft (private scratchpad, not published).
  Otherwise keep the rule: approved expert → `open`, else → `archived`.
- *UPDATE (publish) — new `BEFORE UPDATE` trigger `enforce_idea_publish`:* when `status`
  changes **to a public status** (`open`/`resolved`/`closed`) from a non-public one, re-apply
  the expert check — approved expert/admin author → `open`; otherwise coerce to `archived`
  (submitted for admin review). Prevents the "create draft → edit to open" self-publish bypass.
  Status changes *between* public states by the author are unaffected.

**AI access predicate — `public.can_use_lab_ai()`** (SECURITY DEFINER, pinned search_path):
```
returns is_admin()
     OR exists(approved expert where id = auth.uid())
     OR exists(profile where id = auth.uid() and supporter_until > now())
```
Used by the AI endpoints (defense in depth; the endpoints also check it in app code).

**Rate limit:** add an `ai_generate` bucket to `consume_rate_limit` (server-authoritative,
e.g. 30/hour) — the existing zero-policy `rate_limits` table + RPC.

## 4. Drafts capture & list (optimistic, no AI)

**Location:** a **Lab** tab on `/dashboard` (alongside Feed / Discover).

**Capture:** one always-focused input at top. On Enter:
1. Optimistically prepend a row with a temp id + the typed title (status `draft`).
2. `POST /api/drafts` (or a form action) inserts `{ author_id, title, status: 'draft' }`;
   the slug + status triggers run; the response returns `{ id, slug }`.
3. Reconcile the temp row to the real id/slug. On failure: mark the row errored + offer retry.

**List:** the author's `ideas` where `status='draft'`, newest first (SSR initial load; author-only
RLS). Each row collapses/expands. **Draft notes reuse `ideas.summary_md`** (no new column) — the
freeform markdown you write under a draft; capture leaves it empty, expanding reveals the notes
editor. Title + notes inline-editable; edits autosave debounced (~600ms, optimistic) via
`PATCH /api/drafts/[id]`. Delete with a brief undo window.

**Drafts are edited only in the Lab** — the public `/ideas/<slug>` page stays 404 for `draft`
(and `archived`) status, except the author/admin may preview (needed for moderation; see §7).

## 5. Expansion registry

A registry of tool definitions, each: `key`, `label`, `icon`, `gated` (needs `can_use_lab_ai`?),
`status` ('ready' | 'soon'), and a runner. The expanded-draft panel renders every tool uniformly:
a button → runs → shows the stored output (from `ideas.expansions[key]`) + timestamp, re-runnable.

- Client tools (no server): **Copy to agent** — formats title + notes + latest ExecPlan/readable
  plan into a clean handoff prompt → clipboard. Always available.
- Server tools (write to `expansions`): the AI tools in §6.
- "Coming soon" (registered, disabled): **GitHub repo**, **Find venues**, **Link agent**.

Adding a tool = one registry entry + (for server tools) one endpoint. The panel needs no changes.

## 6. The Lab — AI critique↔refine loop & plans

**Engine:** Vercel AI Gateway + Claude via the AI SDK, behind a single server seam
`generate(prompt, schema?)` in `$lib/server/ai.ts` (model string `anthropic/claude-...`; reads
`AI_GATEWAY_API_KEY`). All AI runs are server-side endpoints under `/api/lab/...`, each:
guard `can_use_lab_ai()` → `consume_rate_limit('ai_generate')` → call `generate()` → persist
into `ideas.expansions[...]` (RLS: author-only update) → return JSON.

**Reviewer panel (critique round):** `POST /api/lab/[id]/review` →
`generate()` with a structured-output schema returning, per persona (Skeptic, Methods, Impact,
Clarifying), `comments[]` + `questions[]`. Appended as a new entry to `expansions.critiques[]`
with an incrementing `round`. The panel shows rounds as stacked cards; the user edits notes to
answer, then re-runs → next round. History is kept so progress is visible.

**Distill:**
- `POST /api/lab/[id]/exec-plan` → a structured, agent-executable ExecPlan in markdown
  (objective, method/steps, artifacts, success criteria, risks) → `expansions.exec_plan_md`.
- `POST /api/lab/[id]/readable-plan` → a narrative proto-paper (motivation, approach, expected
  contribution) → `expansions.readable_plan_md`.
Both prompts are fed the title + notes + the latest critique round so they reflect the refinement.

**Hand off:** Copy-to-agent (client) bundles notes + ExecPlan + readable plan into one prompt.

**Cost & failure:** rate-limited per §3; AI errors return a clear message and never corrupt
stored expansions (write only on success). Timeouts surface a retry.

## 7. Publish ("make it a full idea")

A **Publish** action on a draft opens a small confirm (type, optional hypothesis claim, summary
prefilled from notes) → `PATCH` the row's `type/claim/summary_md` + set `status` toward `open`.
The `enforce_idea_publish` UPDATE trigger decides the outcome: expert/admin → live at its slug;
non-expert → `archived` + "submitted for review" toast. The row *becomes* the idea (same slug).

**Admin moderation (closes the gating loop):** the detail loader allows the **author or an admin**
to view `archived`/`draft` ideas (others still 404), and `/admin/ideas` lists `archived`
submissions with a **Promote to open** action (RLS `admins manage ideas` already allows it).

## 8. Security & RLS

- Drafts: `authors read own ideas` (existing) keeps them private; `authenticated insert own
  ideas` (from the gating migration) + the INSERT trigger force `draft`/`archived` correctly.
- Publish bypass: closed by the `enforce_idea_publish` UPDATE trigger (server-authoritative,
  not just app code).
- AI endpoints: `can_use_lab_ai()` + rate limit, both server-side. `AI_GATEWAY_API_KEY` is
  server-only (never `PUBLIC_`). No service-role client anywhere (owner principle).
- `expansions` is author-writable only (covered by `authors update own ideas`); never trusted
  from the client for gating.

## 9. Testing

- **pgTAP:** INSERT-draft stays `draft`; non-expert publish (draft→open) coerced to `archived`;
  expert/admin publish → `open`; `can_use_lab_ai()` truth table (admin / approved expert /
  supporter_until future vs past / none).
- **vitest:** expansion registry; agent-prompt formatter; critique-JSON schema parse/guard;
  `can_use_lab_ai` app-side mirror. AI `generate()` is stubbed — **no live model calls in CI.**
- **e2e:** quick-add a draft (optimistic → appears) → publish as expert → reachable at slug;
  AI tools mocked at the endpoint.

## 10. Out of scope / follow-ups

Real subscription billing (Phase 2) populating `supporter_until`; GitHub/venue/agent-link tools;
streaming responses; multi-draft bulk ops.
