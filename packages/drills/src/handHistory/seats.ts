/**
 * Who is at the table. Every seat has a player. The ones the spot names are in
 * the pot; preflop, the seats still to act behind the hero have not folded
 * either — they hold cards and have put nothing in — and showing them as folded
 * was wrong. Everyone else folded. Opponents are numbered: Villain 1 is the one
 * whose action is being answered, the rest follow in seat order.
 */
import { POSITIONS, type Position } from '../ontology/types.ts';
import type { Scenario } from '../generator/types.ts';
import { PREFLOP_ORDER } from '../generator/seating.ts';
import { bySeat } from './sizing.ts';
import type { SeatRole } from './types.ts';

/**
 * Preflop the seats behind the hero (in acting order) have not acted yet: in an
 * unopened pot that is everyone after the hero; facing a raise it is the seats
 * after the hero; facing a three-bet it is the seats after the three-bettor
 * (the ones between hero and three-bettor folded or are in the pot). Facing a
 * 4-bet nobody is: the seats behind the hero saw the 3-bet and folded before
 * the 4-bettor re-raised past them. Postflop everyone not in the pot folded on
 * an earlier street.
 */
function yetToActSeats(scenario: Scenario, inPot: ReadonlySet<Position>): Position[] {
    if (scenario.street !== 'preflop' || scenario.preflopFacingState === 'facing_4bet') return [];
    const hero = scenario.heroPosition;
    const from = scenario.preflopFacingState === 'facing_3bet' && scenario.villainPosition !== undefined
        ? PREFLOP_ORDER.indexOf(scenario.villainPosition)
        : PREFLOP_ORDER.indexOf(hero);
    return PREFLOP_ORDER.slice(from + 1).filter((seat) => seat !== hero && !inPot.has(seat));
}

function roleOf(seat: Position, hero: Position, inPot: ReadonlySet<Position>, yetToAct: readonly Position[]): SeatRole {
    if (seat === hero) return 'hero';
    if (inPot.has(seat)) return 'in_pot';
    return yetToAct.includes(seat) ? 'yet_to_act' : 'folded';
}

/** Who is in, who is still to act, who has folded — and the villain numbers. */
export function seatRoles(scenario: Scenario): { roles: Map<Position, SeatRole>; labels: Record<Position, string> } {
    const hero = scenario.heroPosition;
    const inPot = new Set<Position>(scenario.villainPositions);
    const yetToAct = yetToActSeats(scenario, inPot);
    const roles = new Map<Position, SeatRole>(POSITIONS.map((seat) => [seat, roleOf(seat, hero, inPot, yetToAct)]));
    // Villain 1 is the opponent being answered; the rest in seat order.
    const numbered: Position[] = [
        ...(scenario.villainPosition === undefined ? [] : [scenario.villainPosition]),
        ...[...inPot].filter((seat) => seat !== scenario.villainPosition).sort(bySeat(POSITIONS)),
        ...yetToAct.sort(bySeat(POSITIONS)),
    ];
    const labels: Record<Position, string> = {
        UTG: 'Folded', UTG1: 'Folded', UTG2: 'Folded', LJ: 'Folded', HJ: 'Folded',
        CO: 'Folded', BTN: 'Folded', SB: 'Folded', BB: 'Folded',
    };
    labels[hero] = 'You';
    numbered.forEach((seat, index) => { labels[seat] = `Villain ${index + 1}`; });
    return { roles, labels };
}

/** The opponents in the pot other than the one being answered, in seat order. */
export const otherOpponents = (scenario: Scenario): Position[] =>
    scenario.villainPositions.filter((seat) => seat !== scenario.villainPosition).sort(bySeat(POSITIONS));
