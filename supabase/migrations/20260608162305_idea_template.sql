-- Phase 6: Manifund-style optional template sections on ideas
-- All four columns are NULLABLE; existing inserts/RLS are unaffected.
alter table public.ideas
  add column resolution_criteria_md text,
  add column methodology_md         text,
  add column theory_of_change_md    text,
  add column extensions_md          text;
