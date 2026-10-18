/**
 * Stage 4 findings: every situation a principle contains, checked for a scenario.
 * The proofs and the search live in `satisfiability.ts`; this turns their
 * answers into findings an author can act on.
 */
import type { OntologyPayload, Principle } from '../ontology/types.ts';
import { CODES, type Finding } from './report.ts';
import { checkSituation, principleSituations, type SatisfiabilityResult } from './satisfiability.ts';

export interface SearchOptions {
    /** Seeded so a failure report is reproducible. */
    readonly seed?: number | undefined;
    /** Board draws before stage 4 gives up on a situation. */
    readonly attemptLimit?: number | undefined;
}

/** The findings one situation's answer produces. */
function findingsFor(outcome: SatisfiabilityResult, principle: Principle, path: string): Finding[] {
    if (outcome.result === 'unsatisfiable') {
        return outcome.conflicts.map((conflict) => ({
            stage: 4,
            severity: 'error',
            code: conflict.slot === 'board_require' ? CODES.BOARD_TAGS_IMPOSSIBLE : CODES.SLOT_UNSATISFIABLE,
            path,
            objectId: principle.id,
            message: `${conflict.slot}: ${conflict.reason}`,
        }));
    }
    if (outcome.result === 'not-found') {
        return [{
            stage: 4,
            severity: 'warning',
            code: CODES.NO_SCENARIO_FOUND,
            path,
            objectId: principle.id,
            message: `No example found in ${outcome.attempts} attempts. This may be unreachable, or merely rare — the search cannot tell the difference.`,
            witness: outcome.attempts,
        }];
    }
    return [];
}

/** Stage 4: can each situation of each principle produce a scenario at all? */
export function stage4Satisfiability(payload: OntologyPayload, options: SearchOptions): Finding[] {
    return payload.principles.flatMap((principle, index) =>
        principleSituations(principle).flatMap(({ situation, path }) => findingsFor(
            checkSituation(situation, { seed: options.seed, limit: options.attemptLimit }),
            principle,
            `/principles/${index}/${path}`,
        )));
}
