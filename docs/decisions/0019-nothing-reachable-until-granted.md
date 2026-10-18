# 0019 Nothing in the database is reachable by a client until a migration grants it

Date: 18 Oct 2026

Postgres lets every role execute every new function, and Supabase's defaults give `anon` and `authenticated` TRUNCATE, REFERENCES and TRIGGER on every new table. Truncate ignores row-level security. The first schema test caught that a signed-in client could have called the ledger posting function.

Decision:
- The first migration revokes those defaults (globally for functions, since a per-schema revoke cannot remove a global default).
- `auto_expose_new_tables = false` in the Supabase config.
- Every migration grants exactly what clients need, table by table and function by function.
- Helper functions live in a `private` schema the API does not expose.
- Public surfaces read `public_*` views: security-invoker views over security-definer functions, the pattern the Supabase advisors accept.

`supabase/tests/001_schema_rules.test.sql` fails if `anon` can reach anything except `public_*` views, or if a client can execute the ledger, outbox, audit or venue-creation functions. CI also runs the Supabase security advisors.
