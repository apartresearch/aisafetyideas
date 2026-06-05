/**
 * Restore-v1 CLI — read the pg_dump backup, transform old→new per the spec, and emit a single
 * idempotent `restore-v1.generated.sql` artifact. Prints COUNTS only (never row contents) — the
 * backup + the generated SQL contain PII and are gitignored.
 *
 * Usage: `npm run etl:restore-v1 [path/to/backup]`
 * (Controller-only: a subagent must not run this against the real backup.)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { parseCopyBlock } from './parse-dump';
import { lit } from './sql';
import * as t from './transform';
import {
  buildDocument,
  AUTH_USERS_COLUMNS,
  AUTH_IDENTITIES_COLUMNS
} from './emit';

const BACKUP = process.argv[2] ?? `${process.env.HOME}/Downloads/db_cluster-16-10-2025@02-48-41.backup`;
const OUT = new URL('./restore-v1.generated.sql', import.meta.url).pathname;

/** Columns of a verbatim auth table that are jsonb and MUST be re-serialized via jsonbFromText (NOT lit). */
const JSONB_VERBATIM = new Set(['raw_app_meta_data', 'raw_user_meta_data', 'identity_data']);

/** Render one verbatim auth row: every column via lit(), except the jsonb columns via jsonbFromText(). */
function verbatimRow(
  row: Record<string, string | null>,
  columns: readonly string[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of columns) {
    const v = row[c] ?? null;
    out[c] = JSONB_VERBATIM.has(c) ? t.jsonbFromText(v) : lit(v);
  }
  return out;
}

function main() {
  const dump = readFileSync(BACKUP, 'utf8');

  const authUsersRaw = parseCopyBlock(dump, 'auth.users').rows;
  const identitiesRaw = parseCopyBlock(dump, 'auth.identities').rows;
  const usersRaw = parseCopyBlock(dump, 'public.users').rows;
  const ideasRaw = parseCopyBlock(dump, 'public.ideas').rows;
  const categoriesRaw = parseCopyBlock(dump, 'public.categories').rows;
  const ideaCatRelsRaw = parseCopyBlock(dump, 'public.idea_category_relation').rows;
  const ideaRelsRaw = parseCopyBlock(dump, 'public.idea_idea_relation').rows;

  // auth.users.created_at by id — used as the profile's created_at fallback.
  const authCreatedAt = new Map<string, string | null>();
  for (const u of authUsersRaw) if (u.id) authCreatedAt.set(u.id, u.created_at ?? null);

  // ── verbatim auth rows ──
  const authUsers = authUsersRaw.map((r) => verbatimRow(r, AUTH_USERS_COLUMNS));
  const identities = identitiesRaw.map((r) => verbatimRow(r, AUTH_IDENTITIES_COLUMNS));

  // ── profiles + experts ──
  const usedHandles = new Set<string>();
  const profiles: Record<string, string>[] = [];
  const experts: Record<string, string>[] = [];
  for (const u of usersRaw) {
    const id = u.id ?? randomUUID();
    const handle = t.uniqueHandle(u.username, u.email, id, usedHandles);
    const displayName = t.displayNameFor(u);
    const createdAt = (u.id ? authCreatedAt.get(u.id) : null) ?? null;
    profiles.push(t.toProfile(u, displayName, handle, createdAt));
    const expert = t.toExpert(u);
    if (expert) experts.push(expert);
  }

  // ── categories (bigint legacy_id → new uuid) ──
  const catMap = new Map<string, string>();
  const usedSlugs = new Set<string>();
  const categories: Record<string, string>[] = [];
  for (const c of categoriesRaw) {
    const newId = randomUUID();
    if (c.id) catMap.set(c.id, newId);
    categories.push(t.toCategory(c, newId, usedSlugs));
  }

  // ── ideas (bigint legacy_id → new uuid) ──
  const ideaMap = new Map<string, string>();
  const ideas: Record<string, string>[] = [];
  for (const i of ideasRaw) {
    const newId = randomUUID();
    if (i.id) ideaMap.set(i.id, newId);
    ideas.push(t.toIdea(i, newId));
  }

  // ── relations (resolved against the legacy_id maps) ──
  const ideaCats = t.resolveIdeaCategories(ideaCatRelsRaw, ideaMap, catMap);
  const ideaRels = t.resolveIdeaRelations(ideaRelsRaw, ideaMap);

  const doc = buildDocument({
    authUsers,
    identities,
    users: profiles,
    experts,
    categories,
    ideas,
    ideaCats,
    ideaRels
  });

  writeFileSync(OUT, doc, 'utf8');

  // COUNTS ONLY — never row contents (PII discipline).
  console.log(
    `wrote ${OUT}: ` +
      `users=${authUsers.length} identities=${identities.length} profiles=${profiles.length} ` +
      `experts=${experts.length} categories=${categories.length} ideas=${ideas.length} ` +
      `idea_categories=${ideaCats.length} idea_relations=${ideaRels.length}`
  );
}

main();
