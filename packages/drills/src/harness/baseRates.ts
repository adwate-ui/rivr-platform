/**
 * The floor an accuracy figure has to beat.
 *
 * A rule that always answers the corpus's most common action scores the
 * frequency of that action, and if the encoding is not clearly beating that,
 * the number being reported is a property of the quiz hands rather than of the
 * rules.
 */
import type { Action, OntologyPayload, QuizHand } from '../ontology/types.ts';
import { answerKindOfAnswer } from '../ontology/types.ts';
import { facesABet } from '../grading/classifyError.ts';
import { actionAnswerOf } from './answers.ts';
import { answerLeaves, EVER_OFFERED, gradesCorrect } from './padAnswers.ts';
import { scenarioFromQuizHand } from './parse/quizScenario.ts';

export interface BaseRates {
    /**
     * What uniform guessing scores, computed exactly rather than assumed:
     * averaged per hand over the pad's real choice set, so a hand whose source
     * left the sizing open is correctly easier to guess than one that pinned it.
     */
    readonly uniformRandomFloor: number;
    /** The corpus's most common source action, and what always answering it scores. */
    readonly modalAction: Action | null;
    readonly modalActionRate: number;
    readonly actionCounts: readonly { action: Action; hands: number }[];
    /**
     * The floor over hands that CAN be answered. The plain floor is dragged down
     * by hands no answer can get right, which flatters the encoding, so both
     * are reported.
     */
    readonly uniformRandomFloorAnswerable: number;
    /**
     * Source answers no facing state could ever offer. `all_in` is an action in
     * the ontology and only a sizing on the pad: re-encode as `raise`/`bet` at
     * all-in sizing, or add the action to the pad.
     */
    readonly unexpressibleAnswers: readonly { quizId: string; action: Action }[];
    /**
     * Hands whose recorded facing state and stated answer contradict each other:
     * a real action, just not on offer in the state the hand records. A hand
     * first to act that answers "fold" describes two different spots, usually
     * because its action log stops before the opponent's bet. Unpassable by
     * construction, and not an encoding error.
     */
    readonly contradictoryAnswers: readonly { quizId: string; action: Action; facingState: string }[];
}

/** Hands answered with each action, most common first. */
function countActions(scored: readonly QuizHand[]): { action: Action; hands: number }[] {
    const counts = new Map<Action, number>();
    scored.forEach((quiz) => {
        const { action } = actionAnswerOf(quiz);
        counts.set(action, (counts.get(action) ?? 0) + 1);
    });
    return [...counts.entries()]
        .map(([action, hands]) => ({ action, hands }))
        .sort((a, b) => b.hands - a.hands || a.action.localeCompare(b.action));
}

interface Guessing {
    probabilitySum: number;
    answerable: number;
    readonly unexpressible: { quizId: string; action: Action }[];
    readonly contradictory: { quizId: string; action: Action; facingState: string }[];
}

/** What guessing from the pad scores on each readable hand, and which hands no guess can pass. */
function guessing(scored: readonly QuizHand[], payload: OntologyPayload): Guessing {
    const tally: Guessing = { probabilitySum: 0, answerable: 0, unexpressible: [], contradictory: [] };
    for (const quiz of scored) {
        const scenario = scenarioFromQuizHand(quiz, payload);
        if (scenario === null) continue;
        const answer = actionAnswerOf(quiz);
        const leaves = answerLeaves(scenario);
        const correct = leaves.filter((leaf) => gradesCorrect(leaf, answer)).length;
        if (correct > 0) tally.answerable += 1;
        else if (EVER_OFFERED.includes(answer.action)) {
            const facingState = facesABet(scenario) ? 'facing a bet' : 'not facing a bet';
            tally.contradictory.push({ quizId: quiz.id, action: answer.action, facingState });
        } else {
            tally.unexpressible.push({ quizId: quiz.id, action: answer.action });
        }
        tally.probabilitySum += correct / leaves.length;
    }
    return tally;
}

/**
 * The floors for a payload. Action hands only: a label or a count is answered
 * on a different pad, and folding either in would describe no pad anybody sees.
 */
export function baseRates(payload: OntologyPayload): BaseRates {
    const scored = (payload.quiz_hands ?? []).filter((quiz) =>
        quiz.indeterminate !== true && answerKindOfAnswer(quiz.author_answer) === 'action');
    const actionCounts = countActions(scored);
    const guesses = guessing(scored, payload);
    const modal = actionCounts[0];
    return {
        uniformRandomFloor: scored.length === 0 ? 0 : guesses.probabilitySum / scored.length,
        uniformRandomFloorAnswerable: guesses.answerable === 0 ? 0 : guesses.probabilitySum / guesses.answerable,
        modalAction: modal?.action ?? null,
        modalActionRate: modal === undefined || scored.length === 0 ? 0 : modal.hands / scored.length,
        actionCounts,
        unexpressibleAnswers: guesses.unexpressible,
        contradictoryAnswers: guesses.contradictory,
    };
}
