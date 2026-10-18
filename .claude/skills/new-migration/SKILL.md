---
name: new-migration
description: Create a database migration with row-level security and pgTAP tests. Use for any schema change.
---

# New migration

1. Check the lane contract: does your lane own this table? If not, open a `question` issue and stop.
2. `pnpm supabase migration new <verb_noun>`; one concern per migration.
3. Every new table: `venue_id`, timestamps, RLS enabled, default deny, one policy per role that needs access.
4. Write pgTAP tests in `supabase/tests/` for each policy, including a different venue and the practice venue.
5. `pnpm db:reset && pnpm db:types && pnpm test --filter db`.
6. Rebase on `main` before the PR so CI applies the full history from scratch.
