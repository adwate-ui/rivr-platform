import type { LearnAnswer } from '@rivr/db/learn';
import {
  abstainsOn, deriveSeed, effectiveRule, expandRangeSets, explain, FAST_ANSWER_MS, generateScenario, gradeAnswer, gradeFor, hashSource,
  newCard, parsePayload, rangeSideFor, resolveGoverningAny, review, toAttemptRow, type Action, type AnswerGrade, type AnyResolution,
  type AttemptRow, type CardState, type ComboSet, type Explanation, type OntologyPayload, type Principle, type Scenario, type SizingBucket,
} from '@rivr/drills';

/** A licensed source opened for drilling (#133): the principles the pad can answer, its ranges, and its fingerprint. */
export interface Book {
  readonly payload: OntologyPayload;
  readonly principles: readonly Principle[];
  readonly ranges: ReadonlyMap<string, ComboSet>;
  readonly hash: string;
}

/** One dealt spot and the book's answer to it. */
export interface Spot {
  readonly principle: Principle;
  readonly scenario: Scenario;
  readonly resolution: Extract<AnyResolution, { kind: 'action' }>;
}

/** What the member answered on the pad. */
export interface PadAnswer {
  readonly action: Action;
  readonly sizing?: SizingBucket | undefined;
}

/** A graded answer: the verdict and its explanation, the attempt row to keep, and the principle's card after it. */
export interface Marked {
  readonly grade: AnswerGrade;
  readonly explanation: Explanation;
  readonly attempt: AttemptRow;
  readonly card: CardState;
}

/** A principle the pad answers: an action, not a label or a count, and not marked undrillable. */
function onThePad(principle: Principle): boolean {
  const { rule } = effectiveRule(principle);
  return principle.drillable !== false && rule.kind !== 'classify' && rule.kind !== 'count';
}

/** Opens an encoding, as its text or as JSON (a built-in book), as a book; null when it does not parse. */
export function openBook(raw: unknown): Book | null {
  const { payload } = parsePayload(raw);
  if (payload === null) return null;
  return { payload, principles: payload.principles.filter(onThePad), ranges: expandRangeSets(payload.range_sets), hash: hashSource(payload) };
}

/** Deals a spot for a principle, trying a few seeds from `salt`; null when it has none to give. */
export function dealSpot(book: Book, principle: Principle, salt: string): Spot | null {
  const { rule } = effectiveRule(principle);
  const context = { ranges: book.ranges };
  const range = rule.kind === 'range_lookup' ? book.ranges.get(rule.range_set_id) : undefined;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const seed = deriveSeed(salt, principle.id, attempt);
    const dealt = generateScenario(rule, { seed, range, rangeSide: rangeSideFor(rule, seed), accept: (spot) => !abstainsOn(principle, spot, context) });
    if (!dealt.ok) continue;
    const resolution = resolveGoverningAny(principle, dealt.scenario, context);
    if (resolution.kind === 'action') return { principle, scenario: dealt.scenario, resolution };
  }
  return null;
}

/** An answer and what it is marked with: its own id, the session's, how long it took, the card before it, and when. */
export interface Answering {
  readonly answer: PadAnswer;
  readonly id: string;
  readonly sessionId: string;
  readonly latencyMs: number;
  readonly card: CardState | undefined;
  readonly now: number;
}

/** Grades an answer, explains it, keeps the attempt and moves the principle's card on (FSRS). */
export function markAnswer(book: Book, spot: Spot, { answer, id, sessionId, latencyMs, card, now }: Answering): Marked {
  const grade = gradeAnswer({ kind: 'action', answer }, spot.resolution, spot.scenario, spot.principle);
  const fsrs = gradeFor({ errorClass: grade.klass, fast: latencyMs < FAST_ANSWER_MS });
  const attempt = toAttemptRow({
    id, sessionId, sourceId: book.payload.source.id, sourceHash: book.hash, principleId: spot.principle.id,
    scenario: spot.scenario, answerKind: 'action', submittedAction: answer.action, submittedSizing: answer.sizing,
    correctAction: spot.resolution.outcome.action, correctSizing: spot.resolution.outcome.sizing, provenanceKind: spot.resolution.provenance.kind,
    errorClass: grade.klass, confusedWithSlot: grade.confusedWithSlot, grade: fsrs, latencyMs, correct: grade.correct, now,
  });
  const next = review({ card: card ?? newCard(spot.principle.id), grade: fsrs, now }).card;
  return { grade, explanation: explain(spot.principle, grade, spot.resolution), attempt, card: next };
}

/** A value as JSON, for the server: the engine's rows and cards are plain data. */
export function asJson(value: unknown): LearnAnswer['attempt'] {
  const json: LearnAnswer['attempt'] = JSON.parse(JSON.stringify(value));
  return json;
}

/** Whether a kept answer is an attempt row this app wrote. */
export function isAttemptRow(value: unknown): value is AttemptRow {
  return typeof value === 'object' && value !== null && 'principleId' in value && 'correct' in value && 'street' in value;
}

/** Whether a kept card is a card state this app wrote. */
export function isCardState(value: unknown): value is CardState {
  return typeof value === 'object' && value !== null && 'cardKey' in value && 'reps' in value && 'dueAt' in value;
}
