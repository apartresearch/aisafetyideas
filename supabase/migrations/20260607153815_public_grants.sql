-- ============ Data-API table grants for anon / authenticated ============
-- RLS gates which ROWS a role sees/writes; Postgres still needs table-level GRANTs for the role to
-- touch the table at all. The cloud tables were created via raw SQL (Management API as postgres) and
-- never received these grants, so logged-out/in clients hit "permission denied for table …". This
-- grants the client roles their table privileges; RLS remains the row-level source of truth, so a
-- grant on a table whose policies don't permit an action still denies it at the row level.
--
-- Idempotent (grant/alter default privileges are declarative); safe to re-run. Local stacks already
-- auto-grant, so this is effectively a no-op locally and the real fix on cloud.

grant usage on schema public to anon, authenticated;

-- SELECT for everyone (RLS hides rows a role shouldn't see; e.g. anon only sees verified answers,
-- non-draft ideas, public profiles, etc.).
grant select on all tables in schema public to anon, authenticated;

-- Writes for signed-in users only; RLS WITH CHECK / USING clauses gate which rows. Tables without a
-- client write policy (categories, idea_categories, idea_relations, answer_reviews) still reject
-- writes at the row level - the grant is harmless there.
grant insert, update, delete on all tables in schema public to authenticated;

-- NOTE: rate_limits is intentionally LEFT with these grants but stays locked by its ZERO RLS policies
-- (deny-all): a client SELECT returns 0 rows and UPDATE/DELETE affect 0 rows, while the SECURITY
-- DEFINER consume_rate_limit() (owned by postgres) is the only writer. We deliberately do NOT revoke
-- the grant - revoking turns the client's no-op into a hard "permission denied", which the
-- rate_limits pgTAP lockdown tests (and the standard RLS-as-gate posture) rely on NOT happening.

-- Keep future tables working without another grants migration (objects created by postgres inherit these).
alter default privileges in schema public grant select on tables to anon, authenticated;
alter default privileges in schema public grant insert, update, delete on tables to authenticated;
