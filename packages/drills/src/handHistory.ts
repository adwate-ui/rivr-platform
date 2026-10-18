/**
 * The spot as a hand history — who is at the table, who did what, street by
 * street, with amounts — and what that puts in front of each player.
 *
 * A hand is shown elsewhere in the product as an action history: street,
 * actor, action, amount in currency and in blinds, with each player's chips in
 * front of them and the pot in the middle. The drill showed the same
 * information as a row of badges ("checked to you", "small bet") and a terse
 * line ("Flop: you bet, they called"), so a reader had to learn a second
 * grammar for the same thing. This derives the history the table and the
 * action log render, in that grammar.
 *
 * **Amounts are the pot model's, and say so** (see `handHistory/sizing.ts`).
 * They are estimates and are labelled "about"; what is NOT an estimate is the
 * size bucket of the bet being faced, which the source stated and the rule
 * matched on.
 */

import type { Position } from './ontology/types.ts';
import type { Scenario } from './generator/types.ts';
import { flopPotBb } from './generator/potAndStack.ts';
import { POSTFLOP_ORDER } from './generator/seating.ts';
import { parseStep, type PathStep } from './nodePath.ts';
import { preflopHistory, postedBlinds } from './handHistory/preflopFacing.ts';
import { preflopStory } from './handHistory/preflopStory.ts';
import { seatRoles } from './handHistory/seats.ts';
import { betsFrom, postflopStreetsTo, STREET_GROWTH, sumBets } from './handHistory/sizing.ts';
import { addPendingAction, addUntoldChecks } from './handHistory/streetEnds.ts';
import { replayStep, type StreetPass, type Walk } from './handHistory/streetWalk.ts';
import type { HandHistory, HistoryRow } from './handHistory/types.ts';

export type { HandHistory, HistoryRow, SeatRole } from './handHistory/types.ts';
export { seatRoles } from './handHistory/seats.ts';
export { smallBlindBb } from './handHistory/sizing.ts';

/** One postflop street: its replayed steps, the action being answered, the checks the line implies. */
function walkStreet(pass: StreetPass, steps: readonly PathStep[], inPotOrder: readonly Position[]): HistoryRow[] {
    const { walk } = pass;
    const onStreet = steps.filter((step) => step.street === pass.street);
    onStreet.forEach((step) => replayStep(pass, step));
    const answered = pass.street === walk.scenario.street;
    if (answered) addPendingAction(pass);
    addUntoldChecks(pass, inPotOrder);
    // A street that was bet and called grew the pot by the generator's factor.
    if (!answered && pass.betThisStreet && onStreet.some((step) => step.action === 'call')) {
        walk.pot *= STREET_GROWTH;
        walk.lastBet = 0;
    }
    return pass.rows;
}

/** The rows of every postflop street up to the one being answered. */
function postflopRows(scenario: Scenario, steps: readonly PathStep[]): HistoryRow[] {
    const walk: Walk = {
        scenario,
        pot: scenario.potType === undefined ? 0 : flopPotBb(scenario.potType, scenario.playerCount),
        lastBet: 0,
    };
    const inPotOrder = POSTFLOP_ORDER.filter((position) =>
        position === scenario.heroPosition || scenario.villainPositions.includes(position));
    return postflopStreetsTo(scenario.street).flatMap((street) =>
        walkStreet({ walk, street, rows: [], betThisStreet: false }, steps, inPotOrder));
}

/**
 * The hand so far, the action in front of the hero, and what is on the table.
 * What is in front of people on THIS street — the hero's own bet where the
 * path has one, and the bet being faced — sits on the table; everything
 * earlier was swept into the middle.
 */
export function handHistory(scenario: Scenario): HandHistory {
    const { roles, labels } = seatRoles(scenario);
    if (scenario.street === 'preflop') return preflopHistory(scenario, roles, labels);
    const steps = scenario.nodePath.map(parseStep);
    const rows: HistoryRow[] = [
        ...postedBlinds(scenario),
        ...preflopStory(scenario, steps, roles),
        ...postflopRows(scenario, steps),
    ];
    const bets = betsFrom(rows, scenario.street);
    return { rows, bets, potBb: scenario.potBb === undefined ? undefined : scenario.potBb + sumBets(bets), roles, labels };
}
