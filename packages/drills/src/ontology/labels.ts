/**
 * How each closed vocabulary is spelled for a reader.
 *
 * One set of maps, declared beside the vocabularies, so an added member is a
 * type error here rather than a raw id on a screen; `labels.test.ts` asserts
 * totality over each tuple. Where players spell a value differently from its
 * id, their spelling wins: `two_tone` is "two-tone", `nit` is "a nit".
 */
import type {
    AnswerKind, BoardTag, DrawClass, HandClass, PlayerCount, Position, PotType, RelativeStrength,
    SizingBucket, SprBracket, StackBracket, Street, VillainArchetype, VillainRaiseSize,
} from './vocabulary.ts';
import type { Situation } from './rules.ts';

/** The seat as a screen spells it: `UTG1` is shown as `UTG+1`. */
export const POSITION_LABEL: Readonly<Record<Position, string>> = {
    UTG: 'UTG', UTG1: 'UTG+1', UTG2: 'UTG+2', LJ: 'LJ', HJ: 'HJ',
    CO: 'CO', BTN: 'BTN', SB: 'SB', BB: 'BB',
};

/** The street as a heading. */
export const STREET_NAMES: Readonly<Record<Street, string>> = {
    preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River',
};

export const POT_TYPE_LABEL: Readonly<Record<PotType, string>> = {
    limped: 'limped pot', single_raised: 'single-raised pot',
    three_bet: 'three-bet pot', four_bet_plus: 'four-bet pot or bigger',
};

export const PLAYER_COUNT_LABEL: Readonly<Record<PlayerCount, string>> = {
    heads_up: 'heads up', three_way: 'three-way', multiway: 'multiway',
};

export const STACK_BRACKET_LABEL: Readonly<Record<StackBracket, string>> = {
    short: 'short', standard: 'standard', deep: 'deep', very_deep: 'very deep',
};

/** What the villain's raise or bet was; the reader's own sizes are `SIZING_LABEL`. */
export const VILLAIN_RAISE_SIZE_LABEL: Readonly<Record<VillainRaiseSize, string>> = {
    small: 'small', standard: 'standard', large: 'large', all_in: 'all in',
};

export const SIZING_LABEL: Readonly<Record<SizingBucket, string>> = {
    small: 'Small', medium: 'Medium', large: 'Large', all_in: 'All in',
    // Not a pad button (see PAD_SIZINGS), but a source's outcome may carry it.
    unspecified: 'Unspecified',
};

export const SPR_BRACKET_LABEL: Readonly<Record<SprBracket, string>> = {
    very_low: 'very low', low: 'low', medium: 'medium', high: 'high',
};

export const VILLAIN_ARCHETYPE_LABEL: Readonly<Record<VillainArchetype, string>> = {
    nit: 'a nit', tight_passive: 'tight and passive',
    tight_aggressive: 'tight and aggressive', loose_passive: 'loose and passive',
    loose_aggressive: 'loose and aggressive', calling_station: 'a calling station',
    maniac: 'a maniac', competent_reg: 'a competent regular', unknown: 'unknown',
};

export const BOARD_TAG_LABEL: Readonly<Record<BoardTag, string>> = {
    paired: 'paired', trips: 'trips', monotone: 'monotone', two_tone: 'two-tone',
    rainbow: 'rainbow', connected: 'connected', gapped: 'gapped',
    disconnected: 'disconnected', high: 'high', middling: 'middling', low: 'low',
    ace_high: 'ace high', broadway_heavy: 'broadway heavy',
    straight_possible: 'straight possible', flush_possible: 'flush possible',
    straight_complete: 'straight complete', flush_complete: 'flush complete',
    static: 'static', semi_static: 'semi-static', dynamic: 'dynamic',
    two_wheel_cards: 'two wheel cards',
};

export const HAND_CLASS_LABEL: Readonly<Record<HandClass, string>> = {
    no_pair: 'no pair', ace_high: 'ace high', underpair: 'underpair',
    weak_pair: 'weak pair', second_pair: 'second pair',
    top_pair_weak_kicker: 'top pair, weak kicker',
    top_pair_good_kicker: 'top pair, good kicker', overpair: 'overpair',
    two_pair: 'two pair', set: 'a set', straight: 'a straight',
    flush: 'a flush', full_house_plus: 'a full house or better',
};

export const DRAW_CLASS_LABEL: Readonly<Record<DrawClass, string>> = {
    none: 'no draw', backdoor_flush: 'backdoor flush', backdoor_straight: 'backdoor straight',
    gutshot: 'gutshot', open_ended: 'open-ended', flush_draw: 'flush draw',
    combo_draw: 'combo draw',
};

export const RELATIVE_STRENGTH_LABEL: Readonly<Record<RelativeStrength, string>> = {
    nuts: 'the nuts', strong: 'strong', medium: 'medium', weak: 'weak',
};

/** What kind of question it was, named for what the reader did. */
export const ANSWER_KIND_LABEL: Readonly<Record<AnswerKind, string>> = {
    action: 'Deciding', classify: 'Reading', count: 'Counting',
};

/**
 * A `Situation` coordinate, named for a reader. A verdict that says "this rule
 * gives that answer for a different X" needs X in words, and the `Record` makes
 * a new coordinate a compile error here.
 */
export const SLOT_LABEL: Readonly<Record<keyof Situation, string>> = {
    street: 'street',
    stakes: 'game',
    hero_position: 'seat',
    villain_position: 'the opponent’s seat',
    pot_type: 'kind of pot',
    player_count: 'number of players',
    stack_bracket: 'stack depth',
    preflop_facing_state: 'what you are facing',
    postflop_facing_state: 'what you are facing',
    villain_raise_size: 'the size you are facing',
    villain_types: 'the kind of opponent',
    board_require: 'board texture',
    board_exclude: 'board texture',
    hand_class_any: 'what your hand is',
    draw_class_any: 'what you are drawing to',
    draw_class_exclude: 'what you are drawing to',
    relative_strength_any: 'how strong your hand is',
    runout_any: 'the card that came',
    runout_exclude: 'the card that came',
    spr_bracket: 'the stack-to-pot ratio',
    node_path: 'the way the hand was played',
};
