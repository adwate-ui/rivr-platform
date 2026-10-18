/**
 * Reading a graded result back to the hand and the principle behind it.
 *
 * The report was produced by `runHarness` from the same payload, so every id
 * resolves, and a pass or fail is only reached for a hand that read and a
 * principle that governed it. A lookup that misses here is a bug in the
 * caller, not something to skip.
 */
import type { OntologyPayload, Principle, QuizHand } from '../ontology/types.ts';
import type { Scenario } from '../generator/types.ts';
import { scenarioFromQuizHand } from './parse/quizScenario.ts';
import type { QuizResult } from './results.ts';

/** A graded result with the hand it came from, read back into a spot. */
export interface GradedHand {
    readonly result: QuizResult;
    readonly quiz: QuizHand;
    readonly scenario: Scenario;
}

/** Quiz hands by id. */
export const handsById = (payload: OntologyPayload): ReadonlyMap<string, QuizHand> =>
    new Map((payload.quiz_hands ?? []).map((quiz) => [quiz.id, quiz]));

/** The hand behind a graded result, read the way the harness read it. */
export function readGraded(result: QuizResult, hands: ReadonlyMap<string, QuizHand>, payload: OntologyPayload): GradedHand {
    const quiz = hands.get(result.quizId);
    const scenario = quiz === undefined ? null : scenarioFromQuizHand(quiz, payload);
    if (quiz === undefined || scenario === null) {
        throw new Error(`Graded quiz hand ${result.quizId} cannot be read back from this payload.`);
    }
    return { result, quiz, scenario };
}

/** The id of the principle that governed a graded result. */
export function governingIdOf(result: QuizResult): string {
    if (result.principleId === undefined) throw new Error(`Graded quiz hand ${result.quizId} names no principle.`);
    return result.principleId;
}

/** A principle by id, from the payload the report was produced from. */
export function principleOf(principles: ReadonlyMap<string, Principle>, id: string): Principle {
    const principle = principles.get(id);
    if (principle === undefined) throw new Error(`No principle ${id} in this payload.`);
    return principle;
}
