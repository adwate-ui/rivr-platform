/**
 * The hands the source's own preflop rules would have played, per seat and
 * per action — so a postflop spot deals the hero a hand they could actually
 * have arrived with.
 *
 * Postflop hands used to be dealt by class alone: any two cards that made a
 * weak pair on this board, whatever the story said the hero did preflop. The
 * story said the hero opened under the gun, and the cards said Q-4 offsuit
 * — 91% of one rule's spots held a hand outside the seat's own opening list.
 * Preflop hand selection is what later streets are built on, and a drill
 * that severs the two teaches the wrong thing on the way to the right one.
 *
 * DERIVED from the encoding, not authored beside it. The corpus already
 * states, as `range_lookup` rules, what the hero does from each seat facing
 * each state with each hand; this reads those rules back. A source with no
 * preflop rule for a seat and action gets no filter there — silence, not a
 * guess — except for the two lines `fillGaps` names, where silence had turned
 * into "any two cards" for a seventh of every postflop spot dealt.
 */

import type { Action, Position, PreflopFacingState, Principle } from '../ontology/types.ts';
import { POSITIONS, situationStreets } from '../ontology/types.ts';
import { effectiveRule } from '../grading/resolve.ts';
import { emptyCombos, unionCombos, type ComboSet } from '../range/comboSet.ts';
import type { HeroPreflopAction } from './preflopLine.ts';
import type { Playable } from './types.ts';

/** Facing states that make an in-range `raise` an OPEN and a `call` a limp-along. */
const OPENING_STATES = new Set(['unopened', 'facing_limp']);
/** Facing states that make an in-range `raise` a 3-BET and a `call` a flat. */
const FACING_RAISE_STATES = new Set(['facing_raise', 'facing_raise_and_call', 'facing_steal']);

/**
 * Builds the lookup from a source's principles and its expanded ranges.
 *
 * Every drillable preflop `range_lookup` contributes its in-range hands to
 * the (seat, action) cells it speaks for: an in-range raise in an unopened
 * pot is an open; facing a raise it is a 3-bet; an in-range call facing a
 * raise is a flat. Cells are unions across opponent types and stakes — the
 * question is whether the source would EVER have played the hand that way
 * from that seat, not whether it would against this opponent.
 */
export function preflopPlayable(
    principles: readonly Principle[],
    ranges: ReadonlyMap<string, ComboSet>,
): Playable {
    const cells = new Map<string, ComboSet>();
    for (const principle of principles) {
        const contribution = contributionOf(principle, ranges);
        if (contribution === undefined) continue;
        for (const seat of contribution.seats) {
            for (const action of contribution.actions) {
                const key = `${seat}:${action}`;
                cells.set(key, unionCombos(cells.get(key) ?? emptyCombos(), contribution.combos));
            }
        }
    }
    fillGaps(cells);
    return (seat, action) => cells.get(`${seat}:${action}`);
}

interface Contribution {
    readonly seats: readonly Position[];
    readonly actions: readonly HeroPreflopAction[];
    readonly combos: ComboSet;
}

/** The cells one drillable preflop range rule speaks for, or undefined when it speaks for none. */
function contributionOf(principle: Principle, ranges: ReadonlyMap<string, ComboSet>): Contribution | undefined {
    if (principle.drillable === false) return undefined;
    const { rule } = effectiveRule(principle);
    if (rule.kind !== 'range_lookup' || rule.in_range === undefined) return undefined;
    const streets = situationStreets(rule.situation);
    if (streets !== undefined && !streets.includes('preflop')) return undefined;
    const combos = ranges.get(rule.range_set_id);
    if (combos === undefined) return undefined;
    return {
        seats: rule.situation.hero_position ?? POSITIONS,
        actions: actionsFor(rule.situation.preflop_facing_state ?? [], rule.in_range.action),
        combos,
    };
}

/** An in-range raise when opening is an open, facing a raise a 3-bet; an in-range call facing a raise is a flat. */
function actionsFor(states: readonly PreflopFacingState[], action: Action): HeroPreflopAction[] {
    const opens = states.some((state) => OPENING_STATES.has(state));
    const facesRaise = states.some((state) => FACING_RAISE_STATES.has(state));
    const actions: HeroPreflopAction[] = [];
    if (opens && action === 'raise') actions.push('raise');
    if (facesRaise && action === 'raise') actions.push('3bet');
    if (facesRaise && action === 'call') actions.push('call');
    return actions;
}

/**
 * Two cells the source states no range for, filled from the nearest one it
 * does.
 *
 * Measured: 13.6% of postflop spots were dealt with no preflop filter at all,
 * and every one of them was one of these two lines — the hero opening the
 * small blind, or the hero limping. The hand was then whatever the postflop
 * rule wanted, so a "don't pay people off" drill was played out of a pot the
 * hero had entered with 7-2.
 *
 * Both fills are NARROWINGS, and weaker claims than the ranges around them:
 * neither says "the source would play this hand this way", only "the source
 * plays this hand from this seat at all". They are written here, once, rather
 * than left to each caller to guess at.
 *
 *   - **The small blind's open** takes the big blind's. A source may state
 *     one opening range for the blinds and scope it to the big blind; the
 *     other blind opens those hands or fewer.
 *   - **A limp** takes the seat's own opening range. A source that never
 *     limps states no limping range, but a hand it will not OPEN from a seat
 *     is not one the hero limped in with there either.
 *
 * The big blind is deliberately exempt from the second: in a limped pot they
 * did not limp, they checked their option, and they do that with every hand
 * they are dealt. A filter there would be the fault this module exists to fix,
 * pointing the other way.
 */
function fillGaps(cells: Map<string, ComboSet>): void {
    const blindOpen = cells.get('BB:raise');
    if (blindOpen !== undefined && !cells.has('SB:raise')) cells.set('SB:raise', blindOpen);
    for (const seat of POSITIONS) {
        if (seat === 'BB') continue;
        const open = cells.get(`${seat}:raise`);
        if (open !== undefined && !cells.has(`${seat}:limp`)) cells.set(`${seat}:limp`, open);
    }
}
