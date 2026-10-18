/**
 * The shapes the generator produces and consumes.
 *
 * Kept apart from the generator itself so grading, the harness and the hand
 * history can name a `Scenario` without importing the code that builds one;
 * the generator in turn asks grading questions, and the two would otherwise
 * import each other.
 */
import type { Card } from '../cards/cards.ts';
import type {
    BoardTag, DrawClass, HandClass, PlayerCount, Position, PostflopFacingState, PotType, PreflopFacingState,
    RelativeStrength, RunoutTag, SprBracket, StackBracket, Stakes, Street, VillainRaiseSize,
} from '../ontology/types.ts';
import type { ComboSet } from '../range/comboSet.ts';
import type { HeroPreflopAction } from './preflopLine.ts';

export interface Scenario {
    readonly street: Street;
    readonly heroPosition: Position;
    /** The opponent whose action the hero is answering. */
    readonly villainPosition?: Position | undefined;
    /**
     * Every opponent in the pot, `villainPosition` first. A three-way pot drawn
     * with one opponent would contradict the `player_count` it was graded on.
     */
    readonly villainPositions: readonly Position[];
    /**
     * What kind of pot this is. Absent only for an unopened preflop pot. Preflop
     * it is derived from what the hero is facing rather than sampled, so a
     * "facing a raise" spot is never a four-bet pot.
     */
    readonly potType?: PotType | undefined;
    readonly playerCount: PlayerCount;
    readonly stackBracket: StackBracket;
    /**
     * The effective stack in big blinds, inside `stackBracket`. Optional because
     * a quiz hand carries only what its source stated, and an unstated stack
     * must stay unstated.
     */
    readonly effectiveStackBb?: number | undefined;
    /** Stack-to-pot at the decision. Optional: a quiz hand may not state it. */
    readonly sprBracket?: SprBracket | undefined;
    /**
     * Roughly what is in the middle, in big blinds: the same estimate the SPR
     * bracket is read off, so the two never disagree on screen. Absent preflop
     * and on a quiz hand.
     */
    readonly potBb?: number | undefined;
    /**
     * The game this spot is from. Optional because a quiz hand may not state it,
     * in which case a principle scoped to a stakes level must refuse the hand.
     */
    readonly stakes?: Stakes | undefined;
    readonly preflopFacingState?: PreflopFacingState | undefined;
    readonly postflopFacingState?: PostflopFacingState | undefined;
    readonly villainRaiseSize?: VillainRaiseSize | undefined;
    /** Source-scoped opponent type id, where the rule named one. */
    readonly villainType?: string | undefined;
    /** Empty preflop. */
    readonly board: readonly Card[];
    readonly hole: readonly [Card, Card];
    /**
     * Whose two cards `hole` is: `villain` only for a classify rule asking about
     * an opponent holding. Such a hand is not the hero's to have played, so it is
     * never checked against the hero's preflop ranges or earlier streets.
     */
    readonly holder: 'hero' | 'villain';
    readonly boardTags: readonly BoardTag[];
    readonly handClass?: HandClass | undefined;
    readonly draws?: readonly DrawClass[] | undefined;
    readonly relativeStrength?: RelativeStrength | undefined;
    /** Copied from the rule, never extended. */
    readonly nodePath: readonly string[];
    /** What the most recent card changed, derived from the cards. Turn and river only. */
    readonly runouts?: readonly RunoutTag[] | undefined;
    /**
     * On the river, what the turn card changed (1.8), so a river rule that
     * excludes `flush_completing` also refuses a flush the turn completed.
     */
    readonly priorRunouts?: readonly RunoutTag[] | undefined;
    readonly seed: number;
}

export type GenerateResult =
    | { readonly ok: true; readonly scenario: Scenario }
    | {
        readonly ok: false;
        /**
         * `spot-impossible` is the table's veto, not the deck's: the rule names a
         * hero seat that leaves nobody who could have done what the hero is
         * facing, so no board and no hand would make it a real spot.
         */
        readonly reason: 'board-not-found' | 'hand-not-found' | 'line-not-found'
            | 'rule-abstains' | 'spot-impossible';
        readonly attempts: number;
    };

/** Stack-to-pot boundaries, as a source states them. */
export type SprThresholds = Readonly<Record<'very_low_max' | 'low_max' | 'medium_max', number>>;

/** Stack-bracket boundaries in big blinds, as a source states them. */
export type StackThresholds = Readonly<Record<'short_max' | 'standard_max' | 'deep_max', number>>;

/**
 * The hands the source's own preflop rules would have played from a seat with
 * an action, or undefined where the source never speaks for that seat.
 */
export type Playable = (seat: Position, action: HeroPreflopAction) => ComboSet | undefined;

/** Whether the hero's own earlier streets hold up for a candidate spot. */
export type LineFits = (candidate: Scenario) => boolean;

export interface GenerateOptions {
    readonly seed: number;
    /** Combinations the hero may hold, for a range-lookup rule. */
    readonly range?: ComboSet | undefined;
    /**
     * Which side of `range` to deal the hero, defaulting to `'in'`. A rule that
     * authored only `out_of_range` abstains on every hand dealt from its range.
     */
    readonly rangeSide?: 'in' | 'out' | undefined;
    /**
     * Reject a candidate the caller cannot use. The session passes
     * `!abstainsOn(principle, ...)`, so a reader is never shown a spot the drawn
     * rule then refuses to grade.
     */
    readonly accept?: ((candidate: Scenario) => boolean) | undefined;
    readonly boardAttemptLimit?: number | undefined;
    readonly handAttemptLimit?: number | undefined;
    readonly lineAttemptLimit?: number | undefined;
    /** The source's own stack-to-pot boundaries; the defaults fill any it omits. */
    readonly sprBrackets?: Partial<SprThresholds> | undefined;
    /** The source's own stack-bracket boundaries, likewise. */
    readonly stackBrackets?: Partial<StackThresholds> | undefined;
    /**
     * The streets and stakes the session is drilling, where it named any. The
     * scenario is drawn from the intersection of what the rule allows and what
     * the session asked for.
     */
    readonly streets?: readonly Street[] | undefined;
    readonly stakes?: readonly Stakes[] | undefined;
    /**
     * `preflopPlayable`: when the spot says the hero raised, called or 3-bet
     * preflop, the hole cards come from what the source plays that way from that
     * seat. Only for a predicate rule; a range rule's hand is its range.
     */
    readonly playable?: Playable | undefined;
    /**
     * `lineFits`: whether the hero's own earlier postflop streets hold up.
     * Consulted only when the rule's line has a hero step on an earlier street.
     */
    readonly lineFits?: LineFits | undefined;
}
