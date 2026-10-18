# 0017 Three code-declared catalogues have no venue_id

Date: 18 Oct 2026

CLAUDE.md rule 4 says every table has `venue_id`. Three tables hold lists declared in code, identical for every venue:

- `role_permission`: the seven roles and their permissions (`packages/contracts/src/roles.ts`)
- `feature`: the feature catalogue (`packages/contracts/src/features.ts`)
- `setting_key`: the effective-dated setting keys and their value schemas (`packages/contracts/src/settings.ts`)

Decision: these three are global. A copy per venue would let venues drift from the code, and nothing in them is venue data. Everything a venue decides (which tiers get a feature, the values of settings, who holds which role) lives in venue tables. They have row-level security; clients may only read them, and only migrations change them. `supabase/tests/001_schema_rules.test.sql` names them as the only exceptions, and `packages/db/src/catalogues.test.ts` keeps them equal to the code.
