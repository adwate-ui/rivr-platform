# 0037 A SQL twin of a money rule is proved against the golden file

Date: 19 Oct 2026. Task #221.

Some money rules run in the database as well as in `@rivr/domain`, because a write function must compute the amount it posts (the Academy fee now; rake, TDS and GST later). The two must never drift apart.

Both are proved against the same golden file in `packages/testing/golden/`:

- The domain's golden test reads the file, as for every rule.
- `pnpm supabase test db` first loads every case of every golden file into `golden.golden_case` in the local database (`scripts/lib/golden-cases.mjs`). A pgTAP file, `supabase/tests/024_golden_twins.test.sql`, then runs the SQL twin on each case of its file and checks the expected result, and that no operation in the file goes untested.

So adding a case to a golden file is enough to test it on both sides. The `golden` schema is test data only: it is never in a migration, `db reset` drops it, and it never reaches staging or production. A pgTAP run that does not go through `pnpm supabase` fails on the missing table rather than passing.

A new twin adds its section to `024_golden_twins.test.sql`, reading its own file.
