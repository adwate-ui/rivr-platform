/**
 * Reading a quiz hand's answer in the vocabulary of its question.
 */
import type { AuthorAnswer, AuthorCount, AuthorLabel, Outcome, QuizHand } from '../ontology/types.ts';
import { countKey, labelKey } from '../grading/answerKey.ts';

/** A label or a count; an action answer carries no `kind`. */
export type KeyedAnswer = AuthorLabel | AuthorCount;

/** The label or count a source gave, or undefined for an action answer or none. */
export function keyedAnswerOf(answer: AuthorAnswer | undefined): KeyedAnswer | undefined {
    return answer !== undefined && 'kind' in answer ? answer : undefined;
}

/**
 * The action a scored quiz hand's source gave. Indeterminate hands are filtered
 * out before this is asked, and the validator refuses a scored hand with no
 * answer, so a missing one here is a bug in the caller.
 */
export function actionAnswerOf(quiz: QuizHand): Outcome {
    const answer = quiz.author_answer;
    if (answer === undefined || 'kind' in answer) {
        throw new Error(`Quiz hand ${quiz.id} has no action answer to score.`);
    }
    return answer;
}

/** A label or count the source gave, spelt as the reports spell it. */
export const authorKey = (answer: KeyedAnswer): string =>
    (answer.kind === 'classify' ? labelKey(answer.label) : countKey(answer.value));
