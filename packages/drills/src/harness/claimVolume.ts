/**
 * Claim volume against width.
 *
 * A principle that is a candidate for half the corpus while constraining two
 * coordinates is over-claiming by construction: it is answering spots it has no
 * way to judge. That profile, not any single wrong answer, is what a low pass
 * rate usually is.
 */
import type { AnswerKind, OntologyPayload, Principle } from '../ontology/types.ts';
import { answerKindOfAnswer } from '../ontology/types.ts';
import type { Scenario } from '../generator/types.ts';
import { arbitrate, specificity } from '../grading/arbitrate.ts';
import { answerKindOf, effectiveRule } from '../grading/resolve.ts';
import { matchesSituation } from '../grading/match.ts';
import { expandRangeSets } from '../range/expand.ts';
import { scenarioFromQuizHand } from './parse/quizScenario.ts';

export interface ClaimVolume {
    readonly principleId: string;
    /** Scored quiz hands this principle is a CANDIDATE for, before arbitration. */
    readonly handsClaimed: number;
    /** Constrained coordinates, excluding street and node_path. */
    readonly width: number;
    /** Hands it actually governed once arbitration ran. */
    readonly handsGoverned: number;
}

interface Spot {
    readonly scenario: Scenario;
    readonly kind: AnswerKind;
}

/** Whether a principle is a candidate for a spot asking its kind of question. */
function claims(principle: Principle, { scenario, kind }: Spot): boolean {
    if (principle.drillable === false) return false;
    const { rule } = effectiveRule(principle);
    return answerKindOf(rule) === kind && matchesSituation(scenario, rule.situation);
}

const bump = (counts: Map<string, number>, id: string): void => {
    counts.set(id, (counts.get(id) ?? 0) + 1);
};

/**
 * Which principles claim the most, and how little they constrain.
 *
 * The profile to look for is a HIGH claim count against a LOW width. Claims are
 * computed with the real matcher over every coordinate, and each hand is only a
 * claim on rules asking the same kind of question its source answered.
 */
export function claimVolume(payload: OntologyPayload): ClaimVolume[] {
    const ranges = expandRangeSets(payload.range_sets);
    const spots = (payload.quiz_hands ?? [])
        .filter((quiz) => quiz.indeterminate !== true)
        .map((quiz) => ({ scenario: scenarioFromQuizHand(quiz, payload), kind: answerKindOfAnswer(quiz.author_answer) }))
        .filter((spot): spot is Spot => spot.scenario !== null);
    const claimed = new Map<string, number>();
    const governed = new Map<string, number>();
    spots.forEach((spot) => {
        payload.principles.filter((principle) => claims(principle, spot)).forEach((principle) => bump(claimed, principle.id));
        const winner = arbitrate(spot.scenario, payload.principles, { ranges, answerKind: spot.kind }).governing;
        if (winner !== null) bump(governed, winner.id);
    });
    return payload.principles
        .filter((principle) => principle.drillable !== false)
        .map((principle) => ({
            principleId: principle.id,
            handsClaimed: claimed.get(principle.id) ?? 0,
            width: specificity(effectiveRule(principle).rule.situation),
            handsGoverned: governed.get(principle.id) ?? 0,
        }))
        .sort((a, b) => b.handsClaimed - a.handsClaimed
            || a.width - b.width
            || a.principleId.localeCompare(b.principleId));
}
