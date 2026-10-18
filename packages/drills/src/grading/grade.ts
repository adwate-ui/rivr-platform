/**
 * Grading, dispatched on what kind of question was asked.
 *
 * `classifyError` grades an action against an action resolution and knows a
 * great deal about actions — which are legal here, which direction a mistake
 * ran in, whether the reader applied the right idea to the wrong spot. None of
 * that has a counterpart for a label, and bending it into one would mean
 * inventing a direction for an unordered partition.
 *
 * So this is a dispatcher, not a generalisation. It takes a resolution and an
 * answer of the matching kind, sends each to the grader that understands it,
 * and returns the same `Grade` either way, because everything downstream —
 * feedback lookup, the scheduler, the review crosstab — is keyed on
 * `ErrorClass` and should not have to care which question produced it.
 */

import type { Principle } from '../ontology/types.ts';
import type { Scenario } from '../generator/types.ts';
import { classifyError, type Answer, type Grade } from './classifyError.ts';
import type { AnyResolution, ClassifyResolution, CountResolution } from './resolution.ts';

/** The reader's answer, in whichever vocabulary the question used. */
export type AnyAnswer =
    | { readonly kind: 'action'; readonly answer: Answer }
    | { readonly kind: 'classify'; readonly label: string }
    | { readonly kind: 'count'; readonly value: number };

export class AnswerKindMismatchError extends Error {
    constructor(readonly asked: string, readonly answered: string) {
        super(`A ${asked} question cannot be answered with a ${answered}`);
        this.name = 'AnswerKindMismatchError';
    }
}

/**
 * Grades a label against the label the source gives.
 *
 * There is exactly one way to be wrong, and it carries no direction. Labels are
 * a per-rule partition with no ordering — "scare card" is not more aggressive
 * than "brick", it is a different reading — so there is no too-loose or
 * too-tight to report, and a rule that wants to say something particular about
 * one label writes it on that outcome's own feedback.
 */
export function gradeLabel(label: string, resolution: ClassifyResolution): Grade {
    const correct = label === resolution.outcome.label;
    return {
        klass: correct ? 'correct' : 'wrong_label',
        correct,
        secondary: false,
    };
}

/**
 * Grades a count against what the range actually holds.
 *
 * Two ways to be wrong, and they point in opposite directions: too few means
 * the reader missed combinations the range has, too many means they counted
 * some it cannot. That is a real distinction about a range and a source can say
 * something useful about each, which is why this is a pair where `wrong_label`
 * is a single class.
 *
 * `tolerance` comes from the rule and defaults to exact. It is set only where
 * the source itself hedges — "about", "roughly" — never because the arithmetic is
 * hard: a tolerance applied for difficulty hides which of the range and the
 * counter is wrong, and that is the only thing this answer kind measures.
 */
export function gradeCount(value: number, resolution: CountResolution): Grade {
    const off = value - resolution.outcome.value;
    if (Math.abs(off) <= resolution.tolerance) {
        return { klass: 'correct', correct: true, secondary: false };
    }
    return {
        klass: off < 0 ? 'too_few' : 'too_many',
        correct: false,
        secondary: false,
    };
}

/**
 * Grades whichever kind of answer was given, against whichever kind was asked.
 *
 * A mismatch throws rather than grading. It means the pad and the governing
 * rule have come apart — a reader shown four actions while a classify rule
 * governs, or the reverse — and every answer from that point is meaningless.
 * Returning "wrong" would bury a wiring fault in the reader's score.
 */
export function gradeAnswer(
    given: AnyAnswer,
    resolution: AnyResolution,
    scenario: Scenario,
    principle: Principle,
): Grade {
    if (given.kind === 'action' && resolution.kind === 'action') {
        return classifyError(given.answer, resolution, scenario, principle);
    }
    if (given.kind === 'classify' && resolution.kind === 'classify') {
        return gradeLabel(given.label, resolution);
    }
    if (given.kind === 'count' && resolution.kind === 'count') {
        return gradeCount(given.value, resolution);
    }
    throw new AnswerKindMismatchError(resolution.kind, given.kind);
}
