/**
 * The clock boundary, and everything that depends on it.
 *
 * This package never calls `Date.now()`. Time enters as epoch milliseconds
 * passed in by the caller — a screen passes the real clock, a test passes a
 * literal — which is what makes "this card is due in nine days" a claim a test
 * can check rather than one it has to wait for.
 *
 * Milliseconds rather than a `Clock` interface because that is the smallest
 * thing that does the job.
 */

import type { ErrorClass } from '../grading/classifyError.ts';
import {
    DEFAULT_CONFIG,
    intervalDays,
    nextState,
    retrievability,
    type Grade,
    type MemoryState,
    type SchedulerConfig,
} from './fsrs.ts';

export const DAY_MS = 86_400_000;

/** Answered inside this and still correct on the first look counts as easy. */
export const FAST_ANSWER_MS = 8_000;

export type CardPhase = 'new' | 'learning' | 'review' | 'relearning';

export interface CardState {
    readonly cardKey: string;
    readonly memory: MemoryState | null;
    readonly lastReviewedAt: number | null;
    readonly dueAt: number | null;
    readonly reps: number;
    readonly lapses: number;
    readonly phase: CardPhase;
}

/** A card nobody has answered yet: due at once. */
export function newCard(cardKey: string): CardState {
    return {
        cardKey,
        memory: null,
        lastReviewedAt: null,
        dueAt: null,
        reps: 0,
        lapses: 0,
        phase: 'new',
    };
}

/**
 * How an error class becomes a grade.
 *
 * **The single biggest lever on how the feature feels**, which is why it is a
 * table here rather than a chain of comparisons buried in a function. A source
 * that wants sizing errors treated as harshly as directional ones changes one
 * line.
 *
 * The reasoning: a directional mistake means the rule was not understood, so
 * the card resets. A sizing slip or a right-idea-wrong-spot means the rule WAS
 * understood and misapplied, which is worth shortening the interval rather
 * than starting over.
 */
export const ERROR_CLASS_GRADE: Readonly<Record<ErrorClass, Grade>> = {
    correct: 3,
    wrong_sizing: 2,
    right_idea_wrong_spot: 2,
    too_loose: 1,
    too_tight: 1,
    too_passive: 1,
    too_aggressive: 1,
    // A label is a reading, not a line, so there is no half-right version of
    // getting it wrong the way a sizing slip is half-right. It resets, like the
    // directional mistakes.
    wrong_label: 1,
    // Counting is arithmetic over a range: being out by any amount means the
    // range or the method was misread, so it resets like a directional miss.
    too_few: 1,
    too_many: 1,
};

export interface GradeInput {
    readonly errorClass: ErrorClass;
    /** First look at this card in the session, and answered quickly. */
    readonly fast: boolean;
}

/** The FSRS grade an answer earns. */
export function gradeFor({ errorClass, fast }: GradeInput): Grade {
    const base = ERROR_CLASS_GRADE[errorClass];
    // Only a correct answer can be promoted to easy; speed on a wrong answer
    // is not a virtue.
    return base === 3 && fast ? 4 : base;
}

export interface ReviewInput {
    readonly card: CardState;
    readonly grade: Grade;
    /** Epoch milliseconds. The caller owns the clock. */
    readonly now: number;
}

export interface ReviewResult {
    readonly card: CardState;
    readonly elapsedDays: number;
    readonly intervalDays: number;
}

function phaseAfter(previous: CardPhase, grade: Grade): CardPhase {
    if (grade === 1) return previous === 'new' ? 'learning' : 'relearning';
    if (previous === 'new' || previous === 'learning') return 'review';
    if (previous === 'relearning') return 'review';
    return 'review';
}

/** Applies one answer to one card. */
export function review(
    { card, grade, now }: ReviewInput,
    config: SchedulerConfig = DEFAULT_CONFIG,
): ReviewResult {
    const elapsedDays = card.lastReviewedAt === null
        ? 0
        : Math.max((now - card.lastReviewedAt) / DAY_MS, 0);

    const memory = nextState(card.memory, elapsedDays, grade, config);
    const interval = intervalDays(memory.stability, config);

    return {
        elapsedDays,
        intervalDays: interval,
        card: {
            ...card,
            memory,
            lastReviewedAt: now,
            dueAt: now + interval * DAY_MS,
            reps: card.reps + 1,
            lapses: card.lapses + (grade === 1 ? 1 : 0),
            phase: phaseAfter(card.phase, grade),
        },
    };
}

/** A never-seen card is always due; otherwise it is due when its date passes. */
export function isDue(card: CardState, now: number): boolean {
    return card.dueAt === null || card.dueAt <= now;
}

/** How overdue, in days. Negative for a card not yet due. */
export function overdueDays(card: CardState, now: number): number {
    if (card.dueAt === null) return Infinity;
    return (now - card.dueAt) / DAY_MS;
}

/** Current recall probability, for the progress view. 1 for an unseen card. */
export function currentRetrievability(
    card: CardState,
    now: number,
    config: SchedulerConfig = DEFAULT_CONFIG,
): number {
    if (card.memory === null || card.lastReviewedAt === null) return 1;
    return retrievability((now - card.lastReviewedAt) / DAY_MS, card.memory.stability, config);
}
