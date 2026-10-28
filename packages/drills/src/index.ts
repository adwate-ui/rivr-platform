/**
 * @rivr/drills: the hold'em drill engine behind Learn.
 *
 * An encoding (a source's principles, ranges and quiz hands, as JSON) is
 * parsed and validated here; spots are generated from its rules, answers are
 * graded against it, and principles are scheduled by FSRS. Pure TypeScript:
 * no React, no storage, no network, no money format of its own.
 */

// The ontology: every vocabulary and shape an encoding is written in.
export * from './ontology/types.ts';

// Reading and validating an encoding.
export { parsePayload, payloadOrThrow, type ParseResult } from './parse/payload.ts';
export { validateSource, type ValidateOptions } from './validator/index.ts';
export {
    CODES, STAGE_NAMES, countBySeverity, groupByObject, isError,
    type Finding, type FindingCode, type Severity, type StageNumber, type ValidationReport,
} from './validator/report.ts';
export { runHarness, type HarnessReport, type QuizResult } from './harness/quizHarness.ts';
// A quiz hand as a spot the pad can show (#134's lessons ask the book's own hands).
export { scenarioFromQuizHand } from './harness/parse/quizScenario.ts';

// Cards.
export {
    DECK, DECK_CARDS, RANK_LABEL, RANK_NAMES, SUIT_NAMES, formatCard, parseCard,
    type Card, type RankCode, type SuitCode,
} from './cards/cards.ts';

// Generating a spot.
export { generateScenario, rangeSideFor } from './generator/scenario.ts';
export { preflopPlayable } from './generator/playable.ts';
export { lineFits } from './generator/lineFits.ts';
export type { GenerateOptions, GenerateResult, LineFits, Playable, Scenario } from './generator/types.ts';
export { expandRangeSets } from './range/expand.ts';
export type { ComboSet } from './range/comboSet.ts';
export { GRID_CELLS, type GridCell } from './range/grid.ts';
export { deriveSeed, makeRng, type Rng } from './prng.ts';

// Telling a spot: in words, as a hand history, and as the source's strategy grid.
export {
    bigBlindOf, describeCard, describeCards, describeScenario, describeShort, potLabel, stackLabel,
    type MoneyFormatter,
} from './describeScenario.ts';
export { handHistory, type HandHistory, type HistoryRow, type SeatRole } from './handHistory.ts';
export { ENGLISH_WORDS, type DrillSentences, type DrillWords } from './words.ts';
export {
    handCell, postflopStrategy, preflopStrategy, type StrategyCell, type StrategyRow,
} from './strategy.ts';

// Grading an answer.
export {
    abstainsOn, answerKindOf, effectiveRule, resolveGoverningAny, type AnyResolution, type ResolveContext,
} from './grading/resolve.ts';
export { governingPrinciple } from './grading/arbitrate.ts';
export { gradeAnswer, type AnyAnswer } from './grading/grade.ts';
export {
    ERROR_CLASS_LABEL, legalActions, type Answer, type ErrorClass, type Grade as AnswerGrade,
} from './grading/classifyError.ts';
export { explain, NEUTRAL_FALLBACK, type Explanation } from './grading/feedback.ts';
export {
    ACTION_LABEL, PAD_SIZINGS, PAD_SLOTS, describeAnswer, describeOutcome, sizingHints, takesSizing,
} from './grading/pad.ts';

// Scheduling with FSRS.
export {
    FAST_ANSWER_MS, gradeFor, isDue, newCard, review, type CardPhase, type CardState, type ReviewResult,
} from './scheduler/schedule.ts';
export type { Grade as ReviewGrade } from './scheduler/fsrs.ts';
export { buildQueue, practicePool, summariseQueue, type QueueEntry, type QueueSummary } from './scheduler/queue.ts';
export {
    DUE_SCOPE, SESSION_LENGTHS, describeScope, inScope, type DrillScope, type SessionLength,
} from './scheduler/scope.ts';
export { masteryByUnit, masteryOf, type Mastery } from './scheduler/mastery.ts';

// Analytics: attempts, the crosstab and the leaks it finds.
export { hashSource, toAttemptRow, type AttemptRow, type RecordAttemptInput } from './analytics/attempt.ts';
export {
    DIMENSIONS, MIN_ATTEMPTS, crosstab, crosstab2, findLeaks, secondsLabel, summarise, topLeaks,
    type Cell, type Dimension, type Leak, type MatrixCell, type OverallSummary,
} from './analytics/crosstab.ts';
