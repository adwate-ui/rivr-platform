import {
  abstainsOn, answerKindOfAnswer, deriveSeed, describeAnswer, governingPrinciple, scenarioFromQuizHand, effectiveRule, explain, generateScenario, gradeAnswer, rangeSideFor, resolveGoverningAny,
  type AnyResolution, type Explanation, type Principle, type Scenario,
} from '@rivr/drills';
import type { Book } from './drill.ts';

/** How many questions a lesson's quiz asks, at most. */
export const QUIZ_LENGTH = 5;

/** A lesson (#134): one unit of a book, its principles to read as cards, and those its quiz is dealt from. */
export interface Lesson {
  readonly unitId: string;
  readonly label: string;
  readonly cards: readonly Principle[];
  readonly quizzed: readonly Principle[];
}

/** The engine's answer to a quiz question: a label, or a number it works out. */
export type QuizResolution = Extract<AnyResolution, { kind: 'classify' | 'count' }>;

/** One quiz question: the principle, the dealt spot, and its answer. */
export interface QuizSpot {
  readonly principle: Principle;
  readonly scenario: Scenario;
  readonly resolution: QuizResolution;
}

/** What the member answered: one of the rule's labels, or a number. */
export type QuizAnswer = { readonly kind: 'classify'; readonly label: string } | { readonly kind: 'count'; readonly value: number };

/** A marked answer: whether it was right, the right answer in words, and why. */
export interface QuizMark {
  readonly correct: boolean;
  readonly answer: string;
  readonly explanation: Explanation;
}

/** A principle a quiz can ask: a label or a count, and not marked undrillable. */
function isQuizzed(principle: Principle): boolean {
  const { rule } = effectiveRule(principle);
  return principle.drillable !== false && (rule.kind === 'classify' || rule.kind === 'count');
}

/** The book's lessons in its own order: each unit with principles in force, as cards, and those a quiz can ask. */
export function lessonsOf(book: Book): Lesson[] {
  const units = [...(book.payload.source_units ?? [])].sort((a, b) => a.order - b.order);
  return units.flatMap((unit) => {
    const cards = book.payload.principles.filter((principle) => principle.source_unit_id === unit.id && (principle.status ?? 'active') === 'active');
    return cards.length === 0 ? [] : [{ unitId: unit.id, label: unit.label, cards, quizzed: cards.filter(isQuizzed) }];
  });
}

/** Deals one question for a label or count principle, trying a few seeds from `salt`; null when it has none to give. */
export function dealQuizSpot(book: Book, principle: Principle, salt: string): QuizSpot | null {
  const { rule } = effectiveRule(principle);
  if (rule.kind !== 'classify' && rule.kind !== 'count') return null;
  const context = { ranges: book.ranges, answerKind: rule.kind };
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const seed = deriveSeed(salt, principle.id, attempt);
    const dealt = generateScenario(rule, { seed, range: undefined, rangeSide: rangeSideFor(rule, seed), accept: (spot) => !abstainsOn(principle, spot, context) });
    if (!dealt.ok) continue;
    const resolution = resolveGoverningAny(principle, dealt.scenario, context);
    if (resolution.kind === 'classify' || resolution.kind === 'count') return { principle, scenario: dealt.scenario, resolution };
  }
  return null;
}

/** A quiz hand's own answer: the author's label or count. */
type AuthorAnswer = NonNullable<NonNullable<Book['payload']['quiz_hands']>[number]['author_answer']>;

/** Whether the engine's answer for a principle is the author's: the same label, or a count within the author's tolerance. */
function agrees(resolution: AnyResolution, answer: AuthorAnswer): resolution is QuizResolution {
  if (!('kind' in answer)) return false;
  if (resolution.kind === 'classify' && answer.kind === 'classify') return resolution.outcome.label === answer.label;
  if (resolution.kind === 'count' && answer.kind === 'count') return Math.abs(resolution.outcome.value - answer.value) <= (answer.tolerance ?? 0);
  return false;
}

/**
 * The book's own worked examples for a lesson (#134; the owner on #579): its label and count quiz hands, each placed in
 * the lesson whose principle governs it (as the quiz harness arbitrates), and only where that principle answers as the
 * author did.
 */
export function quizHandSpots(book: Book, lesson: Lesson): QuizSpot[] {
  return (book.payload.quiz_hands ?? []).flatMap((hand) => {
    const answer = hand.author_answer;
    if (answer === undefined) return [];
    const kind = answerKindOfAnswer(answer);
    if (kind !== 'classify' && kind !== 'count') return [];
    const scenario = scenarioFromQuizHand(hand, book.payload);
    if (scenario === null) return [];
    // The principle the engine says governs the hand, as the quiz harness asks; the lesson's only if it is one of its.
    const context = { ranges: book.ranges, answerKind: kind };
    const principle = governingPrinciple(scenario, book.payload.principles, context);
    if (principle === null || !lesson.quizzed.includes(principle)) return [];
    const resolution = resolveGoverningAny(principle, scenario, context);
    return agrees(resolution, answer) ? [{ principle, scenario, resolution }] : [];
  });
}

/** A lesson's quiz: up to `length` questions, the book's own hands first, then spots dealt from its principles in turn. */
export function dealQuiz(book: Book, lesson: Lesson, salt: string, length = QUIZ_LENGTH): QuizSpot[] {
  const spots: QuizSpot[] = quizHandSpots(book, lesson).slice(0, length);
  for (let index = 0; spots.length < length && index < length * 3 && lesson.quizzed.length > 0; index += 1) {
    const principle = lesson.quizzed[index % lesson.quizzed.length];
    const spot = principle === undefined ? null : dealQuizSpot(book, principle, `${salt}:${String(index)}`);
    if (spot !== null) spots.push(spot);
  }
  return spots;
}

/** The right answer in words: the label, or the count of what it is out of ("12 of 24"). */
function rightAnswer(spot: QuizSpot): string {
  if (spot.resolution.kind === 'count') return describeAnswer({ kind: 'count', value: spot.resolution.outcome.value, of: spot.resolution.outcome.of });
  const { rule } = effectiveRule(spot.principle);
  return describeAnswer({ kind: 'classify', label: spot.resolution.outcome.label, labels: rule.kind === 'classify' ? rule.labels : [] });
}

/** Grades an answer as the drill engine does, with the book's own feedback. */
export function markQuiz(spot: QuizSpot, given: QuizAnswer): QuizMark {
  const grade = gradeAnswer(given, spot.resolution, spot.scenario, spot.principle);
  return { correct: grade.correct, answer: rightAnswer(spot), explanation: explain(spot.principle, grade, spot.resolution) };
}
