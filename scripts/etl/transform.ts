import { lit, jsonbLit, type Cell } from './sql';

/** A parsed dump row (column → unescaped text or null). */
type Row = Record<string, string | null>;
/** A transformed row of pre-rendered SQL cells, keyed by target column. */
export type SqlRow = Record<string, string>;

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const bool = (v: string | null | undefined) => v === 't' || v === 'true';
/** Old data used a single space as the "empty" default for some text fields. */
const nullifBlank = (v: string | null | undefined): string | null => {
  if (v === null || v === undefined) return null;
  const t = v.trim();
  return t === '' ? null : v;
};

const JSON_CTRL_ESCAPE: Record<string, string> = {
  '\b': '\\b',
  '\t': '\\t',
  '\n': '\\n',
  '\f': '\\f',
  '\r': '\\r'
};

/**
 * Render a VERBATIM jsonb source column: parse the (already COPY-unescaped) text and re-serialize
 * canonically, so escaped control chars produce a valid jsonb literal. Throws on invalid JSON (fail fast).
 *
 * The COPY parser unescapes `\t`/`\n`/etc. into real 0x09/0x0A control characters, which strict JSON
 * (`JSON.parse`) rejects inside string literals. Re-escape those raw control chars (0x00-0x1F) back to
 * their JSON escape sequences before parsing, then re-stringify canonically via jsonbLit - yielding a
 * jsonb literal Postgres accepts.
 */
export function jsonbFromText(field: string | null): string {
  if (field === null) return 'NULL';
  // eslint-disable-next-line no-control-regex
  const safe = field.replace(/[\u0000-\u001f]/g, (c) => {
    const named = JSON_CTRL_ESCAPE[c];
    if (named) return named;
    return `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`;
  });
  return jsonbLit(JSON.parse(safe));
}

export function uniqueHandle(
  username: string | null,
  email: string | null,
  id: string,
  used: Set<string>
): string {
  const id4 = id.replace(/-/g, '').slice(0, 4);
  const base = slugify(username ?? '') || slugify((email ?? '').split('@')[0] ?? '') || `user-${id4}`;
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

/** Parse the old `public.users.user_metadata` text column (jsonb-as-text) → object, tolerant of null. */
function parseMeta(v: string | null | undefined): Record<string, unknown> {
  if (v === null || v === undefined) return {};
  try {
    const o = JSON.parse(v);
    return o && typeof o === 'object' ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Best display name for a profile: user_metadata.name ?? .full_name ?? username. */
export function displayNameFor(u: Row): string | null {
  const meta = parseMeta(u.user_metadata);
  const name = (meta.name ?? meta.full_name) as string | undefined;
  return (name ?? u.username) ?? null;
}

/**
 * `public.users` → `public.profiles` (spec §3.3). Returns pre-rendered SQL cells keyed by target column.
 * Note: the `legacy` cell is built faithfully (like_weight / username / user_metadata) for losslessness;
 * the emitter only projects the columns that exist on the target table.
 */
export function toProfile(u: Row, displayName: string | null, handle: string, createdAt: string | null): SqlRow {
  const meta = parseMeta(u.user_metadata);
  const avatar = u.image ?? ((meta.picture as string | undefined) ?? null);
  const created: Cell = createdAt ?? { sql: 'now()' };
  return {
    id: lit(u.id),
    handle: lit(handle),
    display_name: lit(displayName),
    avatar_url: lit(avatar),
    bio_md: lit(nullifBlank(u.bio)),
    career_stage: lit(u.career_stage ?? null),
    links: "'{}'::jsonb",
    is_admin: 'false',
    legacy: jsonbLit({
      like_weight: u.like_weight ?? undefined,
      username: u.username ?? undefined,
      user_metadata: Object.keys(meta).length ? meta : undefined
    }),
    created_at: lit(created)
  };
}

/** `public.experts` (spec §3.4) — only when the old `expert` flag is set; otherwise null. */
export function toExpert(u: Row): SqlRow | null {
  if (!bool(u.expert)) return null;
  return {
    id: lit(u.id),
    status: lit('approved'),
    featured: 'false',
    approved_by: 'NULL',
    approved_at: 'now()'
  };
}

/** `public.categories` (spec §3.5). `slug` is made unique against `used` with a numeric suffix. */
export function toCategory(c: Row, newId: string, used: Set<string>): SqlRow {
  const base = slugify(c.title ?? '') || `category-${c.id}`;
  let slug = base;
  let n = 2;
  while (used.has(slug)) slug = `${base}-${n++}`;
  used.add(slug);
  return {
    id: lit(newId),
    legacy_id: lit(c.id),
    slug: lit(slug),
    title: lit(c.title ?? null),
    description: lit(c.tooltip ?? null),
    priority: lit(c.priority ?? null),
    legacy: jsonbLit({ project_factory: c.project_factory ?? undefined })
  };
}

/** `public.ideas` (spec §3.6). `author_id` resolves directly (user UUIDs preserved); null when absent. */
export function toIdea(i: Row, newId: string): SqlRow {
  return {
    id: lit(newId),
    legacy_id: lit(i.id),
    author_id: lit(i.user ?? null),
    type: lit(ideaType(i.hypothesis ?? null)),
    title: lit(i.title ?? null),
    summary_md: lit(i.summary ?? null),
    claim: 'NULL',
    status: lit(ideaStatus({ archived: i.archived ?? null, finished: i.finished ?? null })),
    importance: lit(i.importance ?? null),
    from_date: lit(i.from_date ?? null),
    contact: lit(i.contact ?? null),
    currency: lit(i.funding_currency ?? 'USD'),
    published_at: lit(i.created_at ?? null),
    created_at: lit(i.created_at ?? null),
    legacy: jsonbLit({
      experience: i.experience ?? undefined,
      author: i.author ?? undefined,
      useful: i.useful ?? undefined,
      success: i.success ?? undefined,
      sourced: i.sourced ?? undefined,
      difficulty: i.difficulty ?? undefined,
      career_difficulty: i.career_difficulty ?? undefined,
      verified_by_expert: i.verified_by_expert ?? undefined,
      filtered: i.filtered ?? undefined,
      verifier: i.verifier ?? undefined,
      funding_amount: i.funding_amount ?? undefined,
      funding_currency: i.funding_currency ?? undefined,
      funding_from: i.funding_from ?? undefined,
      mentorship_from: i.mentorship_from ?? undefined,
      project_factory: i.project_factory ?? undefined,
      finished: i.finished ?? undefined,
      finished_link: i.finished_link ?? undefined,
      finished_date: i.finished_date ?? undefined,
      archived: i.archived ?? undefined,
      archive_reason: i.archive_reason ?? undefined
    })
  };
}

/**
 * `public.idea_category_relation` → `public.idea_categories` (spec §3.7).
 * Resolves both bigint sides via the legacy_id→uuid maps; drops rows where either side is unresolved.
 */
export function resolveIdeaCategories(
  rels: Row[],
  ideaMap: Map<string, string>,
  catMap: Map<string, string>
): SqlRow[] {
  const out: SqlRow[] = [];
  for (const r of rels) {
    const ideaUuid = r.idea != null ? ideaMap.get(r.idea) : undefined;
    const catUuid = r.category != null ? catMap.get(r.category) : undefined;
    if (!ideaUuid || !catUuid) continue;
    out.push({ idea_id: lit(ideaUuid), category_id: lit(catUuid) });
  }
  return out;
}

/**
 * `public.idea_idea_relation` → `public.idea_relations` (spec §3.8).
 * Resolves parent/child via the ideas legacy_id→uuid map; carries `type`; drops self-relations + unresolved.
 */
export function resolveIdeaRelations(rels: Row[], ideaMap: Map<string, string>): SqlRow[] {
  const out: SqlRow[] = [];
  for (const r of rels) {
    if (r.parent != null && r.child != null && r.parent === r.child) continue; // self-relation
    const parentUuid = r.parent != null ? ideaMap.get(r.parent) : undefined;
    const childUuid = r.child != null ? ideaMap.get(r.child) : undefined;
    if (!parentUuid || !childUuid) continue;
    out.push({
      legacy_id: lit(r.id),
      parent_id: lit(parentUuid),
      child_id: lit(childUuid),
      type: lit(r.type ?? null)
    });
  }
  return out;
}
