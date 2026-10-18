# @rivr/testing

Test helpers for every package: the design prompt's seed as typed fixtures, factories with sensible defaults, fresh ids, and the golden-file loader. Depends on `@rivr/contracts` only (`docs/decisions/0013`).

## Public API

| Export | What it does |
|---|---|
| `designPromptSeed` | The seed of the design prompt (section 5) with the six tables of the 14 Oct additions: `clock`, `venue`, `practiceVenue`, `tables` (`table1` to `table5`, `privateRoom`), `members` (`arjun`, `kabir`, `naina`, `rohan`), `arjun` with his balances, `waitlist`, `dealer`, `dealerDown`, `badBeatJackpot`, `highHand`, `tournament`, `promotions`. Amounts in paise, times as UTC `Date`s. |
| `ist('2026-11-17 00:10')` | The UTC instant of an IST wall-clock time. |
| `STAKES_50_100`, `STAKES_100_200`, `seedUuid(group, n)` | Seed stakes and the fixed seed ids (`5eed…`). |
| `buildVenue`, `buildTable`, `buildMember`, `buildWaitlistEntry` | A complete record from defaults; pass only the fields the test is about. |
| `newId.venue()`, `newId.member()` … `newId.idempotencyKey()`, `nextTestUuid()` | A fresh valid branded id (`7e57…`). |
| `readGolden(json)`, `casesFor(file, operation)`, `assertOperations(file, operations)`, `goldenInput(case, name)`, `goldenExpected(case, name)` | Load and walk a golden file from `golden/`, imported as `@rivr/testing/golden/<rule>.json`. |
| `Seed*` types, `Stakes`, `Tier`, `GoldenFile`, `GoldenCase` | Types. |

The seed clock is Tuesday 17 Nov 2026 00:10 IST, the Tuesday after the launch. All people are fictional.

## Usage

```ts
import { buildMember, designPromptSeed, readGolden, casesFor } from '@rivr/testing';
import rakeJson from '@rivr/testing/golden/rake.json';

const blackCard = buildMember({ tier: 'black_card', qualifyingStakes: designPromptSeed.tables.table3.stakes });

it.each(casesFor(readGolden(rakeJson), 'rake'))('%s', (_description, goldenCase) => {
  // read goldenInput(goldenCase, 'pot') and compare with goldenExpected(goldenCase, 'rake')
});
```

## Golden files

`golden/<rule>.json` has a `rule`, an `about` note for the reader, and `cases`, each with a plain-language `description`, an `operation`, and `inputs` and `expected` as text. Amounts are written as on a receipt (`"₹2,449.50"`). Every money rule has normal, cap, ₹50-rounding and zero cases.

A rule that also runs in SQL (the Academy fee now; rake, TDS and GST later) is proved against the same file there: `pnpm supabase test db` loads every case into the local database, and `supabase/tests/024_golden_twins.test.sql` runs the SQL twin on each (decision 0037). A case added here is tested on both sides.

## Must not

- Import `@rivr/domain` or any package but `@rivr/contracts`. The domain's own tests use this package.
- Use Node built-ins outside test files; other packages type-check its source without Node types.
- Hold real people's names, numbers or documents.
