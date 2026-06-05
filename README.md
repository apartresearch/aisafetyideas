# AI Safety Ideas (2026 rebuild)
## Develop
1. `npm install`
2. `supabase start` then copy the local URL + anon key into `.env.local` (see `.env.example`)
3. `supabase db reset` (applies migrations + seed)
4. `npm run dev`
## Test
- `npx vitest run` · `supabase test db` · `npx playwright test`
See `docs/superpowers/specs/2026-06-04-aisafetyideas-overhaul-design.md` and `CLAUDE.md`.
