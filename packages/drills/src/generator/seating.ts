/**
 * Who can have acted, given where the hero sits and what the hero is facing.
 *
 * A spot is a question about a table, and a table has an order. For a long
 * time the generator seated "the opponent whose action you are answering"
 * anywhere at all, so a reader on the cutoff was shown "facing a raise" from
 * the button — a seat that has not acted yet — and a blind "facing a
 * late-position steal attempt" from under the gun. A poker player notices
 * that before reading the cards, and stops trusting the question.
 *
 * Pure arithmetic over the position cycle. The generator asks this for the
 * seat it names as the villain and rejects hero seats that leave no legal
 * answer; the validator can ask the same question of a rule's situation.
 */

import {
    POSITIONS,
    type Position, type PostflopFacingState, type PreflopFacingState, type Street,
} from '../ontology/types.ts';
import { parseStep, type PathStep } from '../nodePath.ts';

/** Preflop the order is seat order: under the gun first, the big blind last. */
export const PREFLOP_ORDER: readonly Position[] = POSITIONS;

/** Postflop the blinds act first and the button last. */
export const POSTFLOP_ORDER: readonly Position[] = ['SB', 'BB', 'UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN'];

/** The seats a "steal" comes from: late position raising into the blinds. */
export const STEAL_SEATS: readonly Position[] = ['CO', 'BTN', 'SB'];

const BLINDS: readonly Position[] = ['SB', 'BB'];

const before = (order: readonly Position[], hero: Position): Position[] =>
    order.slice(0, order.indexOf(hero));

const after = (order: readonly Position[], hero: Position): Position[] =>
    order.slice(order.indexOf(hero) + 1);

/** Which side of the hero a line puts the villain on; 'conflict' when no two seats can play it. */
export type VillainSide = 'before_hero' | 'after_hero' | 'conflict';

export interface Facing {
    readonly preflop?: PreflopFacingState | undefined;
    readonly postflop?: PostflopFacingState | undefined;
    /**
     * Postflop: the hero already checked THIS street before the bet arrived —
     * a check-raise spot, or the bet the hero's check invited. Whoever bet
     * then did so after the hero, which is the opposite side of the table from
     * a bet the hero is facing cold. Read off the rule's `node_path` by the
     * generator; a quiz hand carries it in its own action log.
     */
    readonly heroCheckedFirst?: boolean | undefined;
    /**
     * The side of the hero the WHOLE action line puts the villain on — from
     * `pathImpliedVillainSide`. The pending state constrains only the current
     * street; the earlier streets constrain the same two seats just as hard,
     * and ignoring them dealt a spot where the small blind bet AFTER the big
     * blind had checked. A facing state that contradicts this side yields no
     * legal seat, which is the point.
     */
    readonly villainSide?: VillainSide | undefined;
}

/**
 * What the action line says about which side of the hero the villain sits on.
 *
 * The one thing a path states beyond doubt is a CHECK answered by the other
 * player on the same street: the checker acted first, so the checker is out
 * of position. (A bet as a street's first named action says nothing — the
 * other player may have checked untold — and a call answers a bet from
 * either side.) Streets must agree with each other; 'conflict' means the
 * line is not playable by any two seats and the rule needs fixing.
 */
export function pathImpliedVillainSide(nodePath: readonly string[] | undefined): VillainSide | undefined {
    let side: 'before_hero' | 'after_hero' | undefined;
    const steps = (nodePath ?? []).map(parseStep);
    for (const [index, step] of steps.entries()) {
        const implied = sideImpliedByCheck(step, steps.slice(index + 1));
        if (implied === undefined) continue;
        if (side !== undefined && side !== implied) return 'conflict';
        side = implied;
    }
    return side;
}

/** The side a postflop check puts the villain on, when the other player answered it on that street. */
function sideImpliedByCheck(step: PathStep, later: readonly PathStep[]): 'before_hero' | 'after_hero' | undefined {
    const { street, actor } = step;
    if (street === undefined || street === 'preflop' || step.action !== 'check' || actor === undefined) return undefined;
    const answered = later.some((next) => next.street === street && next.actor !== undefined && next.actor !== actor);
    if (!answered) return undefined;
    return actor === 'hero' ? 'after_hero' : 'before_hero';
}

/**
 * The seats the named opponent can legally be in.
 *
 * Empty means "nobody has acted" — an unopened preflop pot — and the spot has
 * no villain seat at all. Preflop, someone the hero is FACING acted earlier in
 * the order, with two exceptions the game itself makes: a three-bet answers
 * the hero's own raise, so it comes from a seat still to act (the blinds
 * included); and a four-bet comes from the raiser the hero three-bet, who was
 * earlier. Postflop, a check, bet or lead into the hero came from a seat
 * ahead of the hero; a raise can come from either side (a check-raise from
 * ahead, a raise of the hero's bet from behind); and first to act means every
 * opponent is still behind.
 */
export function legalVillainSeats(hero: Position, street: Street, facing: Facing): Position[] {
    return street === 'preflop'
        ? preflopVillainSeats(hero, facing.preflop)
        : sided(hero, facing.villainSide, postflopVillainSeats(hero, facing));
}

function preflopVillainSeats(hero: Position, state: PreflopFacingState | undefined): Position[] {
    switch (state) {
        case undefined:
        case 'unopened':
            return [];
        case 'facing_steal':
            return before(PREFLOP_ORDER, hero).filter((seat) => STEAL_SEATS.includes(seat));
        case 'facing_3bet':
            return after(PREFLOP_ORDER, hero);
        case 'facing_raise':
        case 'facing_raise_and_call':
            // A late-position raise into the blinds is a steal, and the encoding
            // says so with `facing_steal`; so a plain "facing a raise" in the
            // blinds came from somewhere earlier.
            return before(PREFLOP_ORDER, hero)
                .filter((seat) => !(BLINDS.includes(hero) && STEAL_SEATS.includes(seat)));
        default:
            return before(PREFLOP_ORDER, hero);
    }
}

function postflopVillainSeats(hero: Position, facing: Facing): Position[] {
    switch (facing.postflop) {
        case 'first_to_act':
            return after(POSTFLOP_ORDER, hero);
        case 'facing_raise':
            return POSTFLOP_ORDER.filter((seat) => seat !== hero);
        case 'facing_bet':
            return facing.heroCheckedFirst === true ? after(POSTFLOP_ORDER, hero) : before(POSTFLOP_ORDER, hero);
        default:
            return before(POSTFLOP_ORDER, hero);
    }
}

/** Postflop seats narrowed to the side of the hero the whole line puts the villain on. */
function sided(hero: Position, side: VillainSide | undefined, seats: Position[]): Position[] {
    if (side === undefined) return seats;
    if (side === 'conflict') return [];
    const allowed = side === 'before_hero' ? before(POSTFLOP_ORDER, hero) : after(POSTFLOP_ORDER, hero);
    return seats.filter((seat) => allowed.includes(seat));
}

/**
 * Did the hero check this street before the action being answered?
 *
 * A same-street `check` step on the path while the hero is facing a bet can
 * only be the hero's: an opponent who checked and then bet would be raising,
 * and the spot would say so. Unprefixed steps are read the same way for the
 * same reason.
 */
export function heroCheckedOn(nodePath: readonly string[] | undefined, street: Street): boolean {
    return (nodePath ?? []).some((step) => {
        const parsed = parseStep(step);
        return parsed.street === street && parsed.action === 'check' && parsed.actor !== 'villain';
    });
}

/**
 * Whether this facing state needs an opponent to have acted at all.
 *
 * The one state that does not is an unopened preflop pot; every other state is
 * defined by somebody's action, so a hero seat that leaves no legal villain
 * (under the gun "facing a raise") is a spot that cannot arise at a table.
 */
export function needsVillain(street: Street, facing: Facing): boolean {
    return !(street === 'preflop' && (facing.preflop === undefined || facing.preflop === 'unopened'));
}
