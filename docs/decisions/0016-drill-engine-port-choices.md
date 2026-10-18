# 0016 Choices made porting the drill engine

Date: 18 Oct 2026

Money: `describeScenario`, `potLabel` and `stackLabel` take a `MoneyFormatter` (an amount in the stakes' own unit, the "5" of "2/5") instead of poker-settle's app formatter. The engine stays free of app and i18n code; Learn passes one built on `formatMoney` from `@rivr/i18n`.

Gates: the eight poker-settle gates are one TypeScript command, `pnpm --filter @rivr/drills gates`, reading every `*.json` in `fixtures/` by default and any folder with `--dir`. Reports are written only with `--report <dir>`, so a run never dirties the repository. The deep 10,000-quiz sweep was not ported; it was never a CI gate.

Allowlists: empty, and an entry for a licensed source cannot be committed because its reason cites the book (0015). If a licensed encoding needs one, it should travel with the uploaded encoding; that needs a decision before it is needed.

Fixture: `example-encoding.json` gained invented quiz hands (one deliberate miss, one hand nothing covers) and is `active`, so every gate enforces rather than reports. Its contradictory `pot_type: limped` on an unopened pot was dropped, which made it no longer thin; the pipeline test now pins its remaining determinacy warning instead.

Strictness: the repository's `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and lint limits were met without assertions: JSON is typed through `src/parse/payload.ts` and quiz hands through `src/harness/parse/`. The 5,000-spot strength digest carries a 30-second timeout because it is CPU-bound and shares the machine with the suite.
