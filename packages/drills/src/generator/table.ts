/**
 * Seating the table a spot is played at: the street, the game, the pot, what
 * the hero faces, and everyone else in the hand.
 *
 * What the hero is FACING comes first, because the rest of the table is read
 * off it: who can have acted, what kind of pot that made, how many are in it.
 */
import {
    POSITIONS, POT_TYPES, STAKES, STREETS, situationStreets,
    type PlayerCount, type Position, type PostflopFacingState, type PotType, type PreflopFacingState,
    type Situation, type Stakes, type Street,
} from '../ontology/types.ts';
import type { Rng } from '../prng.ts';
import { constrained, narrowedTo, sample, sampleCoherent, weightedPick } from './sampling.ts';
import {
    asPostflop, asPreflop, chooseFacing, companySeats, facingOf, OPPONENTS, seatAllowed,
    type FacingChoice, type SeatingContext,
} from './facing.ts';
import { legalVillainSeats } from './seating.ts';
import type { GenerateOptions } from './types.ts';

/**
 * The kind of pot the hero is in preflop, read off what the hero is facing.
 *
 * A limp makes a limped pot; a raise, a steal or a raise-and-call a
 * single-raised one; a three-bet a three-bet pot; a four-bet a four-bet pot.
 * An unopened pot is no kind of pot yet, so the answer is undefined — the
 * ontology has no word for "just the blinds" and inventing one would be
 * worse than saying nothing.
 */
const PREFLOP_POT: Readonly<Record<PreflopFacingState, PotType | undefined>> = {
    unopened: undefined,
    facing_limp: 'limped',
    facing_raise: 'single_raised',
    facing_raise_and_call: 'single_raised',
    facing_steal: 'single_raised',
    facing_3bet: 'three_bet',
    facing_4bet: 'four_bet_plus',
};

/**
 * How often each kind of pot is dealt postflop when a rule does not say:
 * roughly how often they arise at live tables, where most pots are
 * single-raised, limped pots are common and re-raised pots are not.
 */
const POSTFLOP_POT_WEIGHTS: Readonly<Record<PotType, number>> = {
    limped: 0.25, single_raised: 0.55, three_bet: 0.15, four_bet_plus: 0.05,
};

/** Everything about a spot the table decides, before a stack, a board or a hand. */
export interface Table {
    readonly street: Street;
    readonly stakes: Stakes;
    readonly preflopFacingState: PreflopFacingState | undefined;
    readonly postflopFacingState: PostflopFacingState | undefined;
    readonly playerCount: PlayerCount;
    readonly heroPosition: Position;
    readonly villainPosition: Position | undefined;
    readonly villainPositions: readonly Position[];
    readonly potType: PotType | undefined;
}

/**
 * The kind of pot postflop, chosen before the field is seated because the
 * field depends on it: a four-bet pot is a two-player pot. Where the rule is
 * silent the kinds are WEIGHTED, not drawn evenly: sampled evenly, a quarter of
 * every pot-type-free rule's spots were four-bet pots, some of them multiway,
 * though four-bet pots are rare in the games the drills describe. A rule that
 * names its pot types gets them as it named them; that is its claim.
 */
function samplePostflopPot(situation: Situation, rng: Rng): PotType {
    return constrained(situation.pot_type)
        ? rng.pick(situation.pot_type)
        : weightedPick(rng, POT_TYPES.map((type) => [type, POSTFLOP_POT_WEIGHTS[type]] as const));
}

/** Preflop the pot type is derived from the facing state; a rule that names pot types narrows it. */
function preflopPotType(situation: Situation, state: PreflopFacingState | undefined, rng: Rng): PotType | undefined {
    const derived = state === undefined ? undefined : PREFLOP_POT[state];
    if (!constrained(situation.pot_type)) return derived;
    return sampleCoherent(rng, situation.pot_type, derived === undefined ? situation.pot_type : [derived]);
}

interface FieldInput {
    readonly ctx: SeatingContext;
    readonly choice: FacingChoice;
    readonly villainPosition: Position | undefined;
    readonly unopened: boolean;
}

/**
 * Everyone else in the pot. The named villain first — they are the one whose
 * action is being answered — then seats drawn from where the rest of the field
 * can be, in seating order so the pot reads the way it was played. In an
 * unopened pot there is nobody else at all, and the seat choice guaranteed
 * enough company for the count.
 */
function seatField({ ctx, choice, villainPosition, unopened }: FieldInput, rng: Rng): Position[] {
    const [fewest, most] = OPPONENTS[choice.playerCount];
    const spare = companySeats(ctx, choice.heroPosition, choice.facingState).filter((seat) => seat !== villainPosition);
    const named = villainPosition === undefined ? 0 : 1;
    const wanted = unopened ? 0 : Math.min(fewest + rng.nextInt(most - fewest + 1), spare.length + named);
    const extras: Position[] = [];
    while (extras.length < wanted - named && spare.length > 0) {
        const [taken] = spare.splice(rng.nextInt(spare.length), 1);
        if (taken !== undefined) extras.push(taken);
    }
    if (villainPosition === undefined) return extras;
    return [villainPosition, ...extras.sort((a, b) => POSITIONS.indexOf(a) - POSITIONS.indexOf(b))];
}

/** The named opponent: one of the seats that could legally have done what the hero faces. */
function pickVillain(ctx: SeatingContext, choice: FacingChoice, rng: Rng): Position | undefined {
    const facing = facingOf(ctx, choice.facingState);
    const seats = legalVillainSeats(choice.heroPosition, ctx.street, facing)
        .filter((seat) => seatAllowed(ctx.situation, seat));
    return seats.length > 0 ? rng.pick(seats) : undefined;
}

/**
 * Seats the table, or null when the rule describes no table at all (a hero seat
 * that leaves nobody who could have done what the hero is facing).
 */
export function seatTable(situation: Situation, options: GenerateOptions, rng: Rng): Table | null {
    const street = sample(rng, narrowedTo(situationStreets(situation), options.streets), STREETS);
    const stakes = sample(rng, narrowedTo(situation.stakes, options.stakes), STAKES);
    const postflopPot = street === 'preflop' ? undefined : samplePostflopPot(situation, rng);
    const ctx: SeatingContext = { situation, street, postflopPot };
    const choice = chooseFacing(ctx, rng);
    if (choice === null) return null;
    const preflopFacingState = street === 'preflop' ? asPreflop(choice.facingState) : undefined;
    const villainPosition = pickVillain(ctx, choice, rng);
    const potType = street === 'preflop' ? preflopPotType(situation, preflopFacingState, rng) : postflopPot;
    const unopened = street === 'preflop' && preflopFacingState === 'unopened';
    return {
        street,
        stakes,
        preflopFacingState,
        postflopFacingState: street === 'preflop' ? undefined : asPostflop(choice.facingState),
        playerCount: choice.playerCount,
        heroPosition: choice.heroPosition,
        villainPosition,
        villainPositions: seatField({ ctx, choice, villainPosition, unopened }, rng),
        potType,
    };
}
