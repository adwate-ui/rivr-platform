/**
 * The rule model: situations, outcomes, and the four kinds of rule.
 */
import type { SuitCode } from '../cards/cards.ts';
import type {
    Action, BoardTag, ClassifyPerspective, CountDeadCards, DrawClass, HandClass, PlayerCount, Position,
    PostflopFacingState, PotType, PreflopFacingState, RelativeStrength, RunoutTag, SizingBucket,
    SprBracket, StackBracket, Stakes, Street, VillainRaiseSize,
} from './vocabulary.ts';

/**
 * A region of the decision space. Every omitted field means unconstrained, so
 * the generator samples freely on it, which is what lets sources of different
 * granularity coexist. Every present field is a set of allowed values, so a
 * situation is a strict conjunction of per-slot memberships; that is what makes
 * the validator's determinacy check an exact hyperrectangle intersection.
 */
export interface Situation {
    /** A single street (1.0) or a set of them (1.1). Read it through `situationStreets`. */
    street?: Street | Street[];
    /** The game this principle is about. Omit only where the source says the idea holds at every level. */
    stakes?: Stakes[];
    hero_position?: Position[];
    villain_position?: Position[];
    pot_type?: PotType[];
    player_count?: PlayerCount[];
    stack_bracket?: StackBracket[];
    preflop_facing_state?: PreflopFacingState[];
    postflop_facing_state?: PostflopFacingState[];
    villain_raise_size?: VillainRaiseSize[];
    /** Source-scoped `opponent_type` ids, not canonical archetypes. */
    villain_types?: string[];
    board_require?: BoardTag[];
    board_exclude?: BoardTag[];
    hand_class_any?: HandClass[];
    draw_class_any?: DrawClass[];
    /**
     * Draws the hand must not have (1.7). `draw_class_any` is any-of over a hand
     * that can hold several draws at once, so "no real draw" could not be
     * written with it alone.
     */
    draw_class_exclude?: DrawClass[];
    relative_strength_any?: RelativeStrength[];
    runout_any?: RunoutTag[];
    /**
     * Runout tags the spot must not carry (1.7), for rules stated as "unless the
     * turn completes a draw". `runout_any` alone could only say "bricks only",
     * which refuses an overcard the rule is happy to play through.
     */
    runout_exclude?: RunoutTag[];
    spr_bracket?: SprBracket[];
    node_path?: string[];
}

/**
 * The streets a situation admits, or undefined for "any". The one place that
 * knows `street` has two shapes.
 */
export function situationStreets(situation: Situation): Street[] | undefined {
    if (situation.street === undefined) return undefined;
    const streets = Array.isArray(situation.street) ? situation.street : [situation.street];
    return streets.length === 0 ? undefined : streets;
}

/**
 * Feedback is authored once per principle and keyed by error type rather than
 * by scenario, which is why it covers every scenario the generator produces
 * from the rule.
 */
export interface Feedback {
    correct: string;
    too_loose?: string;
    too_tight?: string;
    too_passive?: string;
    too_aggressive?: string;
    wrong_sizing?: string;
    right_idea_wrong_spot?: string;
    /** The reader chose a label the source does not give for this spot (1.9). */
    wrong_label?: string;
    /** The reader's count was under, or over (2.0). */
    too_few?: string;
    too_many?: string;
}

export interface Outcome {
    action: Action;
    sizing?: SizingBucket;
    /**
     * Feedback for this outcome, read before the principle's own (1.7). A
     * principle's feedback cannot explain two different right answers, so every
     * outcome that differs in action from the rule's others says why it is
     * right in its own words (stage 6 enforces it).
     */
    feedback?: Partial<Feedback>;
    /** Spots the source treats as close: graded correct, recorded as secondary. */
    acceptable_alternatives?: { action?: Action; sizing?: SizingBucket }[];
}

export interface RangeLookupRule {
    kind: 'range_lookup';
    situation: Situation;
    range_set_id: string;
    /**
     * Either side may be omitted (1.5), and an omitted side abstains: the rule
     * declines the spot and arbitration passes it on. A source that says what
     * to fold but not what to do with the rest must not be made to invent it.
     */
    in_range?: Outcome;
    out_of_range?: Outcome;
}

export interface PredicateRule {
    kind: 'predicate';
    situation: Situation;
    /** Ordered. First match wins, falling through to `default`. */
    branches: { when: Situation; then: Outcome }[];
    /**
     * What to answer when no branch matches. Optional on purpose: a rule
     * without one abstains on spots its branches do not cover, so a scope error
     * reads as a gap rather than as a wrong answer.
     */
    default?: Outcome;
}

/**
 * One answer a classify rule offers. `id` is graded and stored; `label` is
 * shown. They are separate so a stored attempt keeps its meaning when the
 * wording changes.
 */
export interface ClassifyLabel {
    id: string;
    label: string;
}

export interface ClassifyOutcome {
    /** The `id` of one of the rule's own labels. */
    label: string;
    feedback?: Partial<Feedback>;
}

/**
 * A rule whose answer is a label rather than an action (1.9): "strong fit or
 * weak fit?", "scare card or brick?". Labels are a closed list per rule because
 * each source partitions its questions its own way. Two labels minimum.
 */
export interface ClassifyRule {
    kind: 'classify';
    situation: Situation;
    /** At least two, ids unique within the rule. */
    labels: ClassifyLabel[];
    /**
     * Whose cards the question is about. `villain` means the dealt cards are a
     * hypothetical opponent holding, which the drill must say, and which the
     * generator must not check against the hero's own line.
     */
    perspective: ClassifyPerspective;
    /** The question, shown above the labels. */
    prompt: string;
    branches: { when: Situation; then: ClassifyOutcome }[];
    /** Omitted abstains, exactly as for a predicate rule. */
    default?: ClassifyOutcome;
}

/**
 * How a count question narrows the range. Exactly one shape per question;
 * mirrors `range/onBoard.ts`'s `CountFilter`, which does the counting.
 */
export type CountFilterSpec =
    | { kind: 'total' }
    | { kind: 'hand_class_min'; hand_class: HandClass }
    | { kind: 'hand_class_any'; hand_classes: HandClass[] }
    | { kind: 'draw_class_any'; draw_classes: DrawClass[] }
    /**
     * Omit `suit` to mean the suit the board has three of: the only way to ask
     * about a generated monotone flop, which comes in any suit. The validator
     * then requires the rule to demand a monotone flop.
     */
    | { kind: 'bare_ace_of_suit'; suit?: SuitCode }
    | { kind: 'pocket_pairs' };

/**
 * A rule whose answer is a number of combinations (2.0). It checks whether a
 * transcribed range and the counter agree, not whether the encoding says what
 * the source says, so it is reported on its own line. The hand slots are
 * forbidden in `situation`: the question is about a whole range, and the
 * hero's cards matter only as dead cards.
 */
export interface CountRule {
    kind: 'count';
    situation: Situation;
    /** The range being counted: the opponent's, at this point in the hand. */
    range_set_id: string;
    dead_cards: CountDeadCards;
    filter: CountFilterSpec;
    /** The question, shown above the answer pad. */
    prompt: string;
    /** How far off still counts as right. Defaults to 0; set only where the source itself hedges. */
    tolerance?: number;
}

export type Rule = RangeLookupRule | PredicateRule | ClassifyRule | CountRule;
