/**
 * What the hero may legally press: the one decision the answer pad and the
 * grader share, so the two can never disagree about a spot.
 */

import {
    POSITIONS, POSTFLOP_FACING_STATES, PREFLOP_FACING_STATES, situationStreets, STREETS,
    type Action, type Situation,
} from '../ontology/types.ts';
import { allowedValues } from '../generator/slots.ts';
import type { Scenario } from '../generator/types.ts';

/** The coordinates the pad reads. A Scenario has them all. */
type PadSpot = Pick<Scenario, 'street' | 'postflopFacingState'>
    & Partial<Pick<Scenario, 'preflopFacingState' | 'heroPosition'>>;

/**
 * What the hero may legally do here.
 *
 * The answer pad renders exactly this, so a rule whose outcome is missing from
 * it can never be answered correctly however well the reader knows the source.
 *
 * Three sets, not two. Treating every preflop spot as facing a bet would offer
 * Fold/Call/Raise for a spot whose answer is `check`; treating the unraised big
 * blind as an open pot would offer Check/Bet for a spot whose answer is
 * `raise`. In the big blind with no raise in front you have already paid, so
 * folding is free money left behind and calling is nothing — the live options
 * are to check or to raise, and that is its own set.
 */
export function legalActions(scenario: PadSpot): readonly Action[] {
    if (scenario.street === 'preflop') {
        const unraised = scenario.preflopFacingState === 'unopened'
            || scenario.preflopFacingState === 'facing_limp';
        // The blinds are posted, so an unopened pot is still one you fold, call
        // or raise into — there is nothing to check behind on a button
        // raise-first-in.
        if (scenario.heroPosition === 'BB' && unraised) return ['check', 'raise'];
        return ['fold', 'call', 'raise'];
    }

    const facing = scenario.postflopFacingState === 'facing_bet'
        || scenario.postflopFacingState === 'facing_raise'
        || scenario.postflopFacingState === 'facing_donk';
    return facing ? ['fold', 'call', 'raise'] : ['check', 'bet'];
}

/** Every pad a preflop spot inside the situation can show. */
function preflopPads(situation: Situation): (readonly Action[])[] {
    return allowedValues(situation, 'preflop_facing_state').flatMap((value) => {
        const preflopFacingState = PREFLOP_FACING_STATES.find((state) => state === value);
        if (preflopFacingState === undefined) return [];
        return allowedValues(situation, 'hero_position').flatMap((seat) => {
            const heroPosition = POSITIONS.find((position) => position === seat);
            if (heroPosition === undefined) return [];
            return [legalActions({ street: 'preflop', postflopFacingState: undefined, preflopFacingState, heroPosition })];
        });
    });
}

/**
 * Every pad a situation can produce, without generating a single spot.
 *
 * `legalActions` answers for one concrete spot; the validator has to reason
 * about a rule, which admits a whole family of them. A situation that pins
 * neither street nor facing state can put the reader in front of any of the
 * three pads, and a requirement derived from only one of them would be a
 * requirement about a third of the spots.
 *
 * Built by asking `legalActions` itself over the admitted coordinates rather
 * than by restating its tables, so the two cannot disagree.
 *
 * A self-contradictory situation admits nothing and gets an empty list. Stage 4
 * owns that fault and says so far more clearly than a downstream silence would.
 */
export function legalActionSets(situation: Situation): readonly (readonly Action[])[] {
    const sets = new Map<string, readonly Action[]>();
    for (const street of situationStreets(situation) ?? STREETS) {
        const pads = street === 'preflop'
            ? preflopPads(situation)
            : allowedValues(situation, 'postflop_facing_state').flatMap((value) => {
                const postflopFacingState = POSTFLOP_FACING_STATES.find((state) => state === value);
                return postflopFacingState === undefined ? [] : [legalActions({ street, postflopFacingState })];
            });
        for (const actions of pads) sets.set(actions.join('|'), actions);
    }
    return [...sets.values()];
}

/**
 * Is there money in front of the hero to match? Derived from `legalActions`
 * rather than re-decided, so the two can never disagree about a spot.
 */
export function facesABet(scenario: PadSpot): boolean {
    return legalActions(scenario).includes('fold');
}
