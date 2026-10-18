/**
 * The money behind a spot: the pot it is played into, the stack behind it, and
 * the stack-to-pot bracket the two make.
 *
 * Stack-to-pot is DERIVED from the stack and the pot, postflop only — preflop
 * there is no pot to be deep against. Deriving it is what keeps a 30bb stack in
 * a three-bet pot on the low side of the ratio instead of an independently
 * sampled "SPR high".
 */
import type { PlayerCount, PotType, Situation, SprBracket, StackBracket, Street } from '../ontology/types.ts';
import { STACK_BRACKETS } from '../ontology/types.ts';
import { parseStep } from '../nodePath.ts';
import type { Rng } from '../prng.ts';
import { constrained, sample } from './sampling.ts';
import type { GenerateOptions, SprThresholds, StackThresholds } from './types.ts';

/**
 * Stack-bracket boundaries in big blinds, used where a source states none:
 * conventional live-game readings, with 200 big blinds the start of deep and
 * 300 the start of very deep. A source passes its own through
 * `GenerateOptions.stackBrackets`; these fill in whatever it omits. The harness
 * reads the same numbers off the source for quiz hands, so a bracket means one
 * thing on both sides of the gate.
 */
export const DEFAULT_STACK_BRACKETS: StackThresholds = {
    short_max: 60, standard_max: 199, deep_max: 299,
};

/** Stack-to-pot boundaries used where a source states none. */
export const DEFAULT_SPR_BRACKETS: SprThresholds = {
    very_low_max: 2, low_max: 4, medium_max: 8,
};

type StackSpans = Readonly<Record<StackBracket, readonly [number, number]>>;

/** Big blinds each bracket admits. Nobody sits down with less than twenty. */
function stackSpans(brackets: StackThresholds): StackSpans {
    return {
        short: [20, brackets.short_max],
        standard: [brackets.short_max + 1, brackets.standard_max],
        deep: [brackets.standard_max + 1, brackets.deep_max],
        very_deep: [brackets.deep_max + 1, Math.round(brackets.deep_max * 1.5)],
    };
}

/**
 * Roughly what is in the middle when the flop is dealt, in big blinds, for a
 * heads-up pot of each kind — and how much bigger a third or fourth player
 * makes it. Coarse on purpose: the bracket is what a rule reads, and these
 * only have to put a short stack in a three-bet pot on the low side of it
 * rather than the high side.
 */
const FLOP_POT_BB: Readonly<Record<PotType, number>> = {
    limped: 4,
    single_raised: 8,
    three_bet: 22,
    four_bet_plus: 50,
};
const COUNT_FACTOR: Readonly<Record<PlayerCount, number>> = { heads_up: 1, three_way: 1.5, multiway: 2.2 };
/** A bet and a call on a street roughly doubles-and-a-half the pot. */
const STREET_BET_FACTOR = 2.5;

/** Roughly what the flop is dealt into, in big blinds — the base the street factor grows. */
export function flopPotBb(potType: PotType, playerCount: PlayerCount): number {
    return FLOP_POT_BB[potType] * COUNT_FACTOR[playerCount];
}

/** The pot the hero is looking at on this street, in big blinds. Read by `lineFits` for a rewound street too. */
export function potBbAt(street: Street, potType: PotType, playerCount: PlayerCount, nodePath: readonly string[]): number {
    const prior: readonly Street[] = street === 'turn' ? ['flop'] : street === 'river' ? ['flop', 'turn'] : [];
    const grew = prior.filter((earlier) => nodePath.some((step) => {
        const parsed = parseStep(step);
        return parsed.street === earlier && /^(bet|raise|call)$/.test(parsed.action);
    })).length;
    return flopPotBb(potType, playerCount) * STREET_BET_FACTOR ** grew;
}

/** The stack-to-pot bracket a ratio falls in, by a source's boundaries. */
export function bracketForSpr(spr: number, thresholds: SprThresholds): SprBracket {
    if (spr <= thresholds.very_low_max) return 'very_low';
    if (spr <= thresholds.low_max) return 'low';
    if (spr <= thresholds.medium_max) return 'medium';
    return 'high';
}

/** A stack-to-pot ratio comfortably inside each bracket, for when a rule demands one. */
const SPR_TARGET: Readonly<Record<SprBracket, number>> = { very_low: 1.5, low: 3, medium: 6, high: 12 };

/** The bracket a stack falls in, by the same spans the stack was dealt from. */
function bracketOfStack(bb: number, spans: StackSpans): StackBracket {
    if (bb <= spans.short[1]) return 'short';
    if (bb <= spans.standard[1]) return 'standard';
    if (bb <= spans.deep[1]) return 'deep';
    return 'very_deep';
}

/** The stack, the pot and the stack-to-pot bracket a spot is dealt with. */
export interface StackSizing {
    readonly stackBracket: StackBracket;
    readonly effectiveStackBb: number;
    readonly sprBracket: SprBracket | undefined;
    readonly potBb: number | undefined;
}

/** What the table looks like when the stack is sized: the pot is known by now. */
export interface PotShape {
    readonly street: Street;
    readonly potType: PotType | undefined;
    readonly playerCount: PlayerCount;
}

/**
 * Deals the stack, then derives the stack-to-pot bracket from it and the pot.
 *
 * The stack is rounded to five big blinds: nobody sits down with 187. A rule
 * that insists on a ratio gets a stack that lands in it where the stack
 * bracket allows, and its stated bracket regardless: that is the author's
 * claim, and the validator's to dispute.
 */
export function sizeStacks(situation: Situation, shape: PotShape, options: GenerateOptions, rng: Rng): StackSizing {
    const stackBracket = sample(rng, situation.stack_bracket, STACK_BRACKETS);
    const spans = stackSpans({ ...DEFAULT_STACK_BRACKETS, ...options.stackBrackets });
    const [stackLow, stackHigh] = spans[stackBracket];
    const effectiveStackBb = (stackLow + rng.nextInt(Math.floor((stackHigh - stackLow) / 5) + 1) * 5);
    const dealt = { stackBracket, effectiveStackBb, sprBracket: undefined, potBb: undefined };
    if (shape.street === 'preflop' || shape.potType === undefined) return dealt;
    const pot = potBbAt(shape.street, shape.potType, shape.playerCount, situation.node_path ?? []);
    const thresholds = { ...DEFAULT_SPR_BRACKETS, ...options.sprBrackets };
    const sized = { ...dealt, potBb: Math.round(pot), sprBracket: bracketForSpr(effectiveStackBb / pot, thresholds) };
    const demanded = situation.spr_bracket;
    if (!constrained(demanded) || demanded.includes(sized.sprBracket)) return sized;
    return fitDemandedSpr({ situation, sized, pot, spans }, rng.pick(demanded));
}

interface SprFit {
    readonly situation: Situation;
    readonly sized: StackSizing;
    readonly pot: number;
    readonly spans: StackSpans;
}

/**
 * Moves the stack to where the demanded ratio holds, inside the dealt bracket
 * when it can. A rule that asked for a ratio and never for a stack gets
 * whatever stack the ratio needs, and the bracket follows the stack: keeping
 * the sampled bracket asserted "the pot is large next to what is behind" over
 * a 20-blind pot with 300 blinds behind. The stack is clamped to one a table
 * could hold; past that the ratio is the rule's claim and the validator's to
 * dispute.
 */
function fitDemandedSpr({ situation, sized, pot, spans }: SprFit, demanded: SprBracket): StackSizing {
    const fitted = Math.round((SPR_TARGET[demanded] * pot) / 5) * 5;
    const [stackLow, stackHigh] = spans[sized.stackBracket];
    if (fitted >= stackLow && fitted <= stackHigh) return { ...sized, effectiveStackBb: fitted, sprBracket: demanded };
    if (constrained(situation.stack_bracket)) return { ...sized, sprBracket: demanded };
    const effectiveStackBb = Math.min(Math.max(spans.short[0], fitted), spans.very_deep[1]);
    return { ...sized, effectiveStackBb, stackBracket: bracketOfStack(effectiveStackBb, spans), sprBracket: demanded };
}
