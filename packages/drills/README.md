# @rivr/drills

The hold'em drill engine behind Learn, ported from poker-settle. It reads an encoding (a strategy source's principles, ranges and quiz hands, as JSON against `src/ontology/poker-ontology-v1.schema.json`), validates it in six stages, generates unlimited spots from its rules, grades answers against it, explains them in the source's words, and schedules each principle with FSRS. Pure TypeScript: no React, storage, network or money format of its own.

## Public API

Everything is exported from `src/index.ts`.

| Area | Exports |
|---|---|
| Ontology | every vocabulary tuple and type (`Principle`, `OntologyPayload`, `Situation`, `Street`, ...), the label maps (`POSITION_LABEL`, `HAND_CLASS_LABEL`, ...) |
| Reading an encoding | `parsePayload`, `payloadOrThrow`, `validateSource`, `CODES`, `groupByObject`, `runHarness` |
| Generating a spot | `generateScenario`, `rangeSideFor`, `preflopPlayable`, `lineFits`, `expandRangeSets`, `deriveSeed` |
| Telling a spot | `describeScenario(scenario, formatMoney, words?)`, `describeStep(step, words?)`, `ENGLISH_WORDS`, `DrillWords`, `DrillSentences`, `describeShort`, `potLabel`, `stackLabel`, `handHistory`, `preflopStrategy`, `postflopStrategy` |
| Grading | `governingPrinciple`, `resolveGoverningAny`, `abstainsOn`, `gradeAnswer`, `legalActions`, `explain`, `NEUTRAL_FALLBACK` (the engine's feedback where a principle wrote none; the player shows the catalogue's, #584), `PAD_SIZINGS`, `describeAnswer` |
| Scheduling | `newCard`, `review`, `gradeFor`, `isDue`, `buildQueue`, `inScope`, `masteryOf` |
| Analytics | `toAttemptRow`, `hashSource`, `crosstab`, `crosstab2`, `findLeaks`, `summarise` |

Money is the caller's: `describeScenario` and the pot and stack labels take a `MoneyFormatter`, an amount in the unit the stakes are written in (`docs/decisions/0016`). So are the words (#138): `describeScenario` and `describeStep` take a `DrillWords` (the tables of positions, stacks, pots, boards and actions, and the sentences around them), English (`ENGLISH_WORDS`) by default; the player app fills it from `@rivr/i18n`.

## Usage

```ts
import {
  effectiveRule, expandRangeSets, gradeAnswer, generateScenario, newCard, gradeFor,
  payloadOrThrow, rangeSideFor, resolveGoverningAny, review, validateSource,
} from '@rivr/drills';

const report = validateSource(uploadedJson); // six stages; show report.findings to the uploader
const payload = payloadOrThrow(uploadedJson);
const ranges = expandRangeSets(payload.range_sets);

for (const principle of payload.principles.filter((p) => p.drillable !== false)) {
  const { rule } = effectiveRule(principle);
  const range = rule.kind === 'range_lookup' ? ranges.get(rule.range_set_id) : undefined;
  const dealt = generateScenario(rule, { seed: 11, range, rangeSide: rangeSideFor(rule, 11) });
  if (!dealt.ok) continue; // dealt.reason says why; the session skips the card
  const resolution = resolveGoverningAny(principle, dealt.scenario, { ranges });
  const grade = gradeAnswer(readerAnswer, resolution, dealt.scenario, principle);
  const next = review({ card: newCard(principle.id), grade: gradeFor({ errorClass: grade.klass, fast: false }), now: Date.now() });
}
```

`src/index.test.ts` runs this flow against the fixture.

## Gates

`pnpm --filter @rivr/drills gates` runs the eight encoding gates (sources, generator, winnable, overclaim, feedback, variety, lines, mece) over every encoding in `fixtures/` and `sources/`. `--dir <folder>` gates a licensed encoding kept outside the repository, `--source <file|id>` narrows the run, `--report <folder>` writes the work-list reports. How to write an encoding that passes them: `docs/spec/learn/encoding-guide.md`.

`@rivr/drills/gates` exports `checkEncoding(raw)`: the validator and all eight gates over one encoding's text, with nothing read from or written to disk, and the report as lines (`EncodingCheck`). The console runs it on a super admin's upload before the file is accepted (#131). The command line writes its `--report` files through a `ReportWriter` it passes the gates.

## Must not

- Contain book content outside `sources/`: no quote, page reference, worked hand, printed count or principle id from any book, in code, comments, tests, fixtures or allowlists. Apart from the two books in `sources/` (`docs/decisions/0274`), licensed encodings are uploaded at runtime and never committed (`docs/decisions/0015`).
- Grow beyond hold'em. The ontology, classifiers and grader are hold'em only; PLO and bomb pots need new classifiers in a later phase.
- Format money, read storage, call the network or import app, UI or i18n code.
- Cast parsed JSON outside `src/parse/` (and `src/harness/parse/` for quiz hands).

## Books that ship with RIVR

`sources/` holds the two Ed Miller encodings moved from poker-settle on 28 Oct 2026 (decision 0274, superseding 0015 for these books): "The Course" (`src_course`) and "How To Read Hands" (`src_read_hands`). `@rivr/drills/sources` lists them as `BUILT_IN_SOURCES`, each loaded lazily (`load()`), so the app's entry does not grow. `pnpm --filter @rivr/drills gates` checks `sources/` with `fixtures/` in one run. Any other licensed encoding is still uploaded at runtime (#131).
