-- Idea slugs: human-readable URLs (/ideas/<slug>) generated from the title, with numeric
-- dedupe on collision. Slugs are STABLE (assigned once at insert, never changed on title edit)
-- so existing links never break; the route layer 301-redirects any UUID URL to the slug.

-- ── slugify: lowercase, collapse non-alphanumerics to single hyphens, trim, cap at 80 chars ──
-- IMMUTABLE + pinned search_path so it is safe to use in generated/indexed contexts and passes advisors.
create or replace function public.slugify(txt text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select coalesce(
    nullif(
      trim(both '-' from
        left(
          regexp_replace(lower(txt), '[^a-z0-9]+', '-', 'g'),
          80
        )
      ),
    ''),
    'idea'
  );
$$;

-- ── column ──
-- DEFAULT '' (a transient placeholder) so the trigger below always populates it AND so generated
-- TypeScript Insert types treat slug as optional - column defaults are applied before BEFORE-triggers,
-- so a slug-less insert arrives at the trigger as '' and gets a real slug. It is never persisted as ''.
alter table public.ideas add column slug text not null default '';

-- ── backfill existing rows deterministically (oldest-first keeps the bare slug; later
--    duplicates get -2, -3, …). Window dedupe is fine for the one-time backfill on a small set. ──
with ranked as (
  select
    id,
    public.slugify(title) as base,
    row_number() over (partition by public.slugify(title) order by created_at asc, id asc) as rn
  from public.ideas
)
update public.ideas i
set slug = case when r.rn = 1 then r.base else r.base || '-' || r.rn end
from ranked r
where i.id = r.id;

-- ── enforce uniqueness (after backfill, so the transient '' placeholders are gone) ──
create unique index ideas_slug_key on public.ideas (slug);

-- ── trigger: assign a unique slug on INSERT only (stable). Respects an explicitly provided slug. ──
create or replace function public.set_idea_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  base      text := public.slugify(new.title);
  candidate text := base;
  n         int  := 1;
begin
  if new.slug is not null and new.slug <> '' then
    return new;  -- caller provided a slug explicitly; trust it (unique index is the backstop)
  end if;
  -- find the first free candidate; the unique index guarantees correctness under any race
  while exists (select 1 from public.ideas where slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end;
$$;

create trigger ideas_set_slug
before insert on public.ideas
for each row execute function public.set_idea_slug();
