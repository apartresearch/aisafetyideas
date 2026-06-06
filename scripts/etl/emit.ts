import { insertRows } from './sql';
import type { SqlRow } from './transform';

/**
 * Verbatim `auth.users` columns to import (spec §3.1). The generated `confirmed_at` is skipped.
 * The jsonb columns `raw_app_meta_data` / `raw_user_meta_data` are rendered by the CLI via
 * `jsonbFromText` (NOT `lit`) — see the Key design decisions in the plan.
 */
export const AUTH_USERS_COLUMNS = [
  'instance_id',
  'id',
  'aud',
  'role',
  'email',
  'encrypted_password',
  'email_confirmed_at',
  'invited_at',
  'confirmation_token',
  'confirmation_sent_at',
  'recovery_token',
  'recovery_sent_at',
  'email_change_token_new',
  'email_change',
  'email_change_sent_at',
  'last_sign_in_at',
  'raw_app_meta_data',
  'raw_user_meta_data',
  'is_super_admin',
  'created_at',
  'updated_at',
  'phone',
  'phone_confirmed_at',
  'phone_change',
  'phone_change_token',
  'phone_change_sent_at',
  'email_change_token_current',
  'email_change_confirm_status',
  'banned_until',
  'reauthentication_token',
  'reauthentication_sent_at',
  'is_sso_user',
  'deleted_at',
  'is_anonymous'
] as const;

/** Verbatim `auth.identities` columns (spec §3.2). The generated `email` column is skipped. */
export const AUTH_IDENTITIES_COLUMNS = [
  'provider_id',
  'user_id',
  'identity_data',
  'provider',
  'last_sign_in_at',
  'created_at',
  'updated_at',
  'id'
] as const;

/** Target columns that actually exist on `public.profiles` (no `legacy` column on this table). */
export const PROFILES_COLUMNS = [
  'id',
  'handle',
  'display_name',
  'avatar_url',
  'bio_md',
  'career_stage',
  'links',
  'is_admin',
  'created_at'
] as const;

export const EXPERTS_COLUMNS = ['id', 'status', 'featured', 'approved_by', 'approved_at'] as const;

/** Target columns on `public.categories` (no `legacy` column on this table). */
export const CATEGORIES_COLUMNS = ['id', 'legacy_id', 'slug', 'title', 'description', 'priority'] as const;

export const IDEAS_COLUMNS = [
  'id',
  'legacy_id',
  'author_id',
  'type',
  'title',
  'summary_md',
  'claim',
  'status',
  'importance',
  'from_date',
  'contact',
  'currency',
  'legacy',
  'published_at',
  'created_at'
] as const;

export const IDEA_CATEGORIES_COLUMNS = ['idea_id', 'category_id'] as const;
export const IDEA_RELATIONS_COLUMNS = ['legacy_id', 'parent_id', 'child_id', 'type'] as const;

export type EmitData = {
  authUsers: SqlRow[];
  identities: SqlRow[];
  users: SqlRow[]; // → profiles
  experts?: SqlRow[];
  categories: SqlRow[];
  ideas: SqlRow[];
  ideaCats: SqlRow[];
  ideaRels: SqlRow[];
};

/**
 * Assemble the idempotent restore document (spec §4 order):
 *   begin → session_replication_role=replica → auth.users → auth.identities → profiles → experts
 *         → categories → ideas → idea_categories → idea_relations → session_replication_role=origin
 *         → count + FK-integrity assertions → commit.
 * Every insert is `on conflict do nothing` on a stable key, so the document is re-runnable.
 *
 * NOTE on `session_replication_role = replica` (vs `ALTER TABLE auth.users DISABLE TRIGGER`):
 * `auth.users` is owned by `supabase_auth_admin`, and the role that runs the load (`postgres`) is NOT a
 * superuser and cannot `ALTER` it ("must be owner of table users"). `postgres` CAN, however, `SET
 * session_replication_role`, which is the standard bulk-restore mechanism: it suppresses ALL normal
 * triggers — including the `on_auth_user_created` welcome trigger that would otherwise double-create
 * profiles — and defers FK checks for the load. It is restored to `origin` before the assertions.
 */
export function buildDocument(data: EmitData): string {
  const parts: string[] = [];
  parts.push('begin;');
  parts.push('set session_replication_role = replica;');

  parts.push(insertRows('auth.users', [...AUTH_USERS_COLUMNS], data.authUsers, 'id'));
  parts.push(insertRows('auth.identities', [...AUTH_IDENTITIES_COLUMNS], data.identities, 'id'));
  parts.push(insertRows('public.profiles', [...PROFILES_COLUMNS], data.users, 'id'));
  parts.push(insertRows('public.experts', [...EXPERTS_COLUMNS], data.experts ?? [], 'id'));
  parts.push(insertRows('public.categories', [...CATEGORIES_COLUMNS], data.categories, 'legacy_id'));
  parts.push(insertRows('public.ideas', [...IDEAS_COLUMNS], data.ideas, 'legacy_id'));
  parts.push(insertRows('public.idea_categories', [...IDEA_CATEGORIES_COLUMNS], data.ideaCats, 'idea_id, category_id'));
  parts.push(insertRows('public.idea_relations', [...IDEA_RELATIONS_COLUMNS], data.ideaRels, 'parent_id, child_id'));

  parts.push('set session_replication_role = origin;');

  // ── assertions: counts (>= so re-runs / the 1 pre-existing test row never trip them) + FK integrity
  //    (FK checks were deferred during the load, so verify no orphan author here — fail loud → rollback). ──
  parts.push(
    [
      'do $$ begin',
      // thresholds = the exact numbers v1 restores (265 users/profiles, 19 categories, 238 ideas); `>=` so the
      // cloud's pre-existing test row and any re-run never trip them, and so the same doc passes the fresh-local rehearsal.
      "  assert (select count(*) from auth.users) >= 265, 'auth.users count too low';",
      "  assert (select count(*) from public.profiles) >= 265, 'profiles count too low';",
      "  assert (select count(*) from public.categories) >= 19, 'categories count too low';",
      "  assert (select count(*) from public.ideas) >= 238, 'ideas count too low';",
      '  assert (select count(*) from public.ideas i left join public.profiles p on p.id = i.author_id',
      "          where i.author_id is not null and p.id is null) = 0, 'orphan idea.author_id';",
      'end $$;'
    ].join('\n')
  );

  parts.push('commit;');

  // join with blank lines; insertRows() returns '' for empty batches — filter those out.
  return parts.filter((p) => p.trim() !== '').join('\n\n') + '\n';
}

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
 * (conflict-suppressed inserts; reply updates guarded by `reply_to is null`).
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
