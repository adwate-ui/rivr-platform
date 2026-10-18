/**
 * What the hero is facing, how many are in the pot, and where the hero sits:
 * chosen TOGETHER, because each limits the others.
 *
 * These used to be sampled independently, which produced "facing a raise" from
 * a seat that had not acted, "a four-bet pot ... the pot is unopened", and
 * "unopened ... three-way": questions no table asks. The button cannot be first
 * to act postflop, under the gun cannot be "facing a raise", and the cutoff
 * cannot be first to act in a four-way pot. A facing state is a candidate only
 * if some allowed hero seat leaves somebody who could have done it and room for
 * the rest of the field; a rule whose every combination fails describes no
 * table, and the generator says so rather than shuffling boards for it.
 */
import {
    PLAYER_COUNTS, POSITIONS, POSTFLOP_FACING_STATES, PREFLOP_FACING_STATES, STREETS,
    type PlayerCount, type Position, type PostflopFacingState, type PotType, type PreflopFacingState,
    type Situation, type Street,
} from '../ontology/types.ts';
import { parseStep } from '../nodePath.ts';
import type { Rng } from '../prng.ts';
import { constrained } from './sampling.ts';
import {
    heroCheckedOn, legalVillainSeats, needsVillain, pathImpliedVillainSide,
    POSTFLOP_ORDER, PREFLOP_ORDER, type Facing,
} from './seating.ts';

export type FacingState = PreflopFacingState | PostflopFacingState;

/** What the seating questions read: the rule, the street, and the postflop pot already drawn. */
export interface SeatingContext {
    readonly situation: Situation;
    readonly street: Street;
    readonly postflopPot: PotType | undefined;
}

/**
 * How many opponents are in the pot.
 *
 * `multiway` is a range rather than a number because it means three or more
 * opponents, and four-way pots are common enough that the span must cover them
 * rather than settle on the smallest thing that satisfies the word.
 */
export const OPPONENTS: Readonly<Record<PlayerCount, readonly [number, number]>> = {
    heads_up: [1, 1],
    three_way: [2, 2],
    multiway: [3, 5],
};

/**
 * How many opponents a preflop facing state can have put in the pot.
 *
 * A raise-and-call is at least two of them; a steal or a four-bet is one; a
 * limp is anything; unopened is nobody, recorded as `heads_up` because the
 * type has no zero and the description does not say it aloud.
 */
const PREFLOP_COUNTS: Readonly<Record<PreflopFacingState, readonly PlayerCount[]>> = {
    unopened: ['heads_up'],
    facing_limp: ['heads_up', 'three_way', 'multiway'],
    facing_raise: ['heads_up'],
    facing_raise_and_call: ['three_way', 'multiway'],
    facing_steal: ['heads_up'],
    facing_3bet: ['heads_up', 'three_way'],
    facing_4bet: ['heads_up'],
};

/** The state read as a preflop one; facing states are chosen from the street's own list. */
export const asPreflop = (state: FacingState): PreflopFacingState | undefined =>
    PREFLOP_FACING_STATES.find((candidate) => candidate === state);

/** The state read as a postflop one. */
export const asPostflop = (state: FacingState): PostflopFacingState | undefined =>
    POSTFLOP_FACING_STATES.find((candidate) => candidate === state);

/** Whether the rule lets the named opponent sit in this seat. */
export const seatAllowed = (situation: Situation, seat: Position): boolean =>
    !constrained(situation.villain_position) || situation.villain_position.includes(seat);

/**
 * The facing state as the seating rules read it. Postflop it carries the whole
 * line's seating constraint, not just the pending street's: a path whose flop
 * went check-then-bet has already said which side of the hero the villain sits
 * on, and a facing state that contradicts it must find no seat.
 */
export function facingOf({ situation, street }: SeatingContext, state: FacingState): Facing {
    if (street === 'preflop') return { preflop: asPreflop(state) };
    return {
        postflop: asPostflop(state),
        heroCheckedFirst: heroCheckedOn(situation.node_path, street),
        villainSide: pathImpliedVillainSide(situation.node_path),
    };
}

/**
 * Where the rest of the field can sit, given the hero's seat and what the hero
 * is facing — the named opponent included.
 *
 * Preflop, everyone in the pot has already acted, so they sit ahead of the
 * hero — except around a three-bet, where the hero raised first and the
 * three-bettor and any cold-caller come from behind. Postflop the field sits
 * BEHIND the hero, still to act: a field seat between the bettor and the hero
 * would have to have already responded to the bet, an action the spot never
 * states, and a story with unstated actions is how five live hands once sat
 * through a flop the history said was bet and called by one player.
 */
export function companySeats(ctx: SeatingContext, hero: Position, state: FacingState): Position[] {
    if (ctx.street !== 'preflop') return POSTFLOP_ORDER.slice(POSTFLOP_ORDER.indexOf(hero) + 1);
    return facingOf(ctx, state).preflop === 'facing_3bet'
        ? POSITIONS.filter((seat) => seat !== hero)
        : PREFLOP_ORDER.slice(0, PREFLOP_ORDER.indexOf(hero));
}

/**
 * A line that already saw chips go in on an earlier postflop street is a
 * two-player line: the pot model grew by the heads-up factor and the path names
 * two actors. Dealing it multiway kept five live hands through a flop the story
 * says was bet and called by one.
 */
function lineIsSettled(situation: Situation, street: Street): boolean {
    return (situation.node_path ?? []).map(parseStep).some((step) =>
        step.street !== undefined && step.street !== 'preflop'
        && STREETS.indexOf(step.street) < STREETS.indexOf(street)
        && step.action !== 'check' && step.action !== 'fold');
}

const HEADS_UP: readonly PlayerCount[] = ['heads_up'];

/**
 * Postflop counts. A four-bet pot is heads-up: a third player calling a
 * four-bet is not a table the drills describe. A rule that insists otherwise
 * keeps its list; the validator can argue.
 */
function postflopCounts({ situation, street, postflopPot }: SeatingContext): readonly PlayerCount[] {
    const wanted = situation.player_count;
    const fourBet = postflopPot === 'four_bet_plus';
    const base = constrained(wanted)
        ? (fourBet && wanted.includes('heads_up') ? HEADS_UP : wanted)
        : (fourBet ? HEADS_UP : PLAYER_COUNTS);
    return lineIsSettled(situation, street) ? base.filter((count) => count === 'heads_up') : base;
}

/** The player counts a facing state can produce, narrowed to what the rule allows. */
function countChoices(ctx: SeatingContext, state: FacingState): readonly PlayerCount[] {
    if (ctx.street !== 'preflop') return postflopCounts(ctx);
    const wanted = ctx.situation.player_count;
    const preflop = asPreflop(state);
    const coherent = preflop === undefined ? [] : PREFLOP_COUNTS[preflop];
    if (!constrained(wanted)) return coherent;
    const both = coherent.filter((count) => wanted.includes(count));
    return both.length > 0 ? both : wanted;
}

/**
 * Whether the hero can sit here: somebody legal can have done the facing action
 * AND enough seats remain for the rest of the field. Postflop the field sits
 * behind the hero, so a villain seated in front adds one to what the company
 * can hold, and a villain who must sit behind occupies one of its seats.
 */
function heroFits(ctx: SeatingContext, seat: Position, state: FacingState, count: PlayerCount): boolean {
    const facing = facingOf(ctx, state);
    if (!needsVillain(ctx.street, facing)) return true;
    const villains = legalVillainSeats(seat, ctx.street, facing).filter((v) => seatAllowed(ctx.situation, v));
    if (villains.length === 0) return false;
    const villainInFront = ctx.street !== 'preflop'
        && villains.some((v) => POSTFLOP_ORDER.indexOf(v) < POSTFLOP_ORDER.indexOf(seat));
    const company = companySeats(ctx, seat, state).length + (villainInFront ? 1 : 0);
    return company >= OPPONENTS[count][0];
}

/** The hero seats that work for a facing state and a player count. */
function heroesFor(ctx: SeatingContext, state: FacingState, count: PlayerCount): Position[] {
    const choices = constrained(ctx.situation.hero_position) ? ctx.situation.hero_position : POSITIONS;
    return choices.filter((seat) => heroFits(ctx, seat, state, count));
}

function facingChoices({ situation, street }: SeatingContext): readonly FacingState[] {
    if (street === 'preflop') {
        return constrained(situation.preflop_facing_state) ? situation.preflop_facing_state : PREFLOP_FACING_STATES;
    }
    return constrained(situation.postflop_facing_state) ? situation.postflop_facing_state : POSTFLOP_FACING_STATES;
}

/** The facing state, player count and hero seat a spot is dealt with. */
export interface FacingChoice {
    readonly facingState: FacingState;
    readonly playerCount: PlayerCount;
    readonly heroPosition: Position;
}

/**
 * Picks the facing state first, then a count it allows, then a seat that fits
 * both, so every facing state the rule names is asked, not only the ones with
 * the most seats. Null when no combination describes a real table.
 */
export function chooseFacing(ctx: SeatingContext, rng: Rng): FacingChoice | null {
    const feasible = facingChoices(ctx).flatMap((state) => countChoices(ctx, state)
        .filter((count) => heroesFor(ctx, state, count).length > 0)
        .map((count) => ({ state, count })));
    if (feasible.length === 0) return null;
    const facingState = rng.pick([...new Set(feasible.map((pair) => pair.state))]);
    const playerCount = rng.pick(feasible.filter((pair) => pair.state === facingState).map((pair) => pair.count));
    const heroPosition = rng.pick(heroesFor(ctx, facingState, playerCount));
    return { facingState, playerCount, heroPosition };
}
