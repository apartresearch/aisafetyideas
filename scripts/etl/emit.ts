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
