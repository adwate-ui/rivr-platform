/**
 * The ontology's closed vocabularies, as runtime tuples and the unions they make.
 *
 * `poker-ontology-v1.schema.json` is authoritative. These are hand-written
 * rather than generated because the tuples are consumed at runtime:
 * `Record<BoardTag, Predicate>` is what makes a missing board-tag predicate a
 * compile error, and that needs the union at type level and the members at
 * value level. `types.conformance.test.ts` reconciles every tuple with the
 * schema, so the two cannot drift silently.
 */

/**
 * Versions this build can read.
 *
 * Extensions are additive only and bump the version, so every earlier encoding
 * stays valid. 1.1 added the array form of `situation.street`; 1.7 added actor
 * prefixes on `node_path` steps, `runout_exclude`, `draw_class_exclude`,
 * `source.bet_size_brackets`, `villain_position` on a quiz hand and `feedback`
 * on an outcome; 1.8 added `hand_class: ace_high`, prior runouts and quiz-hand
 * `provenance`; 1.9 added classify rules and 2.0 count rules.
 */
export const ONTOLOGY_VERSIONS = ['1.0', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '1.9', '2.0'] as const;
export type OntologyVersion = typeof ONTOLOGY_VERSIONS[number];

/** The newest version this build writes. */
export const ONTOLOGY_VERSION: OntologyVersion = '2.0';

export const POSITIONS = ['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;
export type Position = typeof POSITIONS[number];

export const STREETS = ['preflop', 'flop', 'turn', 'river'] as const;
export type Street = typeof STREETS[number];

export const POT_TYPES = ['limped', 'single_raised', 'three_bet', 'four_bet_plus'] as const;
export type PotType = typeof POT_TYPES[number];

export const PLAYER_COUNTS = ['heads_up', 'three_way', 'multiway'] as const;
export type PlayerCount = typeof PLAYER_COUNTS[number];

export const STACK_BRACKETS = ['short', 'standard', 'deep', 'very_deep'] as const;
export type StackBracket = typeof STACK_BRACKETS[number];

export const VILLAIN_RAISE_SIZES = ['small', 'standard', 'large', 'all_in'] as const;
export type VillainRaiseSize = typeof VILLAIN_RAISE_SIZES[number];

export const SIZING_BUCKETS = ['small', 'medium', 'large', 'all_in', 'unspecified'] as const;
export type SizingBucket = typeof SIZING_BUCKETS[number];

export const ACTIONS = ['fold', 'check', 'call', 'bet', 'raise', 'limp', 'all_in'] as const;
export type Action = typeof ACTIONS[number];

export const PREFLOP_FACING_STATES = [
    'unopened', 'facing_limp', 'facing_raise', 'facing_raise_and_call',
    'facing_3bet', 'facing_4bet', 'facing_steal',
] as const;
export type PreflopFacingState = typeof PREFLOP_FACING_STATES[number];

export const POSTFLOP_FACING_STATES = [
    'first_to_act', 'facing_check', 'facing_bet', 'facing_raise', 'facing_donk',
] as const;
export type PostflopFacingState = typeof POSTFLOP_FACING_STATES[number];

export const VILLAIN_ARCHETYPES = [
    'nit', 'tight_passive', 'tight_aggressive', 'loose_passive',
    'loose_aggressive', 'calling_station', 'maniac', 'competent_reg', 'unknown',
] as const;
export type VillainArchetype = typeof VILLAIN_ARCHETYPES[number];

/**
 * Flop texture. The last four are the static-to-dynamic scale players use to
 * talk about how much a flop can change; `boardTexture.ts` explains why they
 * are tags of their own rather than combinations of the structural ones.
 */
export const BOARD_TAGS = [
    'paired', 'trips', 'monotone', 'two_tone', 'rainbow',
    'connected', 'gapped', 'disconnected',
    'high', 'middling', 'low',
    'ace_high', 'broadway_heavy',
    'straight_possible', 'flush_possible',
    'straight_complete', 'flush_complete',
    'static', 'semi_static', 'dynamic', 'two_wheel_cards',
] as const;
export type BoardTag = typeof BOARD_TAGS[number];

/**
 * What the hero's cards make. `ace_high` (1.8) is no pair with an ace in the
 * hand: the best unmade hand is often worth a call where a lower one is not, and
 * `no_pair` could not say so. A rule that means any unmade hand lists both.
 */
export const HAND_CLASSES = [
    'no_pair', 'ace_high', 'underpair', 'weak_pair', 'second_pair',
    'top_pair_weak_kicker', 'top_pair_good_kicker', 'overpair',
    'two_pair', 'set', 'straight', 'flush', 'full_house_plus',
] as const;
export type HandClass = typeof HAND_CLASSES[number];

export const DRAW_CLASSES = [
    'none', 'backdoor_flush', 'backdoor_straight', 'gutshot',
    'open_ended', 'flush_draw', 'combo_draw',
] as const;
export type DrawClass = typeof DRAW_CLASSES[number];

export const RELATIVE_STRENGTHS = ['nuts', 'strong', 'medium', 'weak'] as const;
export type RelativeStrength = typeof RELATIVE_STRENGTHS[number];

/**
 * What the card that just landed changed.
 *
 * `four_flush` and `four_straight` name the most dangerous cards in the deck: a
 * fourth card of a suit completes nothing new, so without them a turn that put
 * four hearts out read as a `brick`. `straight_completing_low` carries fills
 * that only low holdings make (the 3 on A-8-5, completed only by 4-2), so the
 * strong tag can mean a fill both of whose ranks are seven or higher.
 */
export const RUNOUT_TAGS = [
    'brick', 'overcard', 'pairs_board', 'pairs_hero',
    'flush_completing', 'flush_drawing', 'four_flush',
    'straight_completing', 'straight_completing_low', 'straight_drawing', 'four_straight',
] as const;
export type RunoutTag = typeof RUNOUT_TAGS[number];

/**
 * Stack-to-pot ratio at the decision. Distinct from stack depth: the same stack
 * yields a very different ratio in a limped pot than in a three-bet one.
 */
export const SPR_BRACKETS = ['very_low', 'low', 'medium', 'high'] as const;
export type SprBracket = typeof SPR_BRACKETS[number];

export const GAME_TEXTURES = [
    'loose_passive', 'loose_aggressive', 'tight_passive',
    'tight_aggressive', 'fold_happy', 'station_heavy',
] as const;
export type GameTexture = typeof GAME_TEXTURES[number];

export const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;
export type Confidence = typeof CONFIDENCE_LEVELS[number];

export const PRINCIPLE_STATUSES = ['active', 'disputed', 'overridden', 'retired'] as const;
export type PrincipleStatus = typeof PRINCIPLE_STATUSES[number];

export const SOURCE_KINDS = ['book', 'video_course', 'article_set', 'personal_notes'] as const;
export type SourceKind = typeof SOURCE_KINDS[number];

export const SOURCE_STATES = ['draft', 'importing', 'validating', 'active', 'archived'] as const;
export type SourceState = typeof SOURCE_STATES[number];

/**
 * The game a principle is about. Advice that is right at one level is often
 * wrong at the next, so a rule that omits stakes claims every game.
 */
export const STAKES = ['1/2', '2/5', '5/10'] as const;
export type Stakes = typeof STAKES[number];

/** Whose cards a classify question is about (1.9). `villain` means a hypothetical opponent holding. */
export const CLASSIFY_PERSPECTIVES = ['hero', 'villain'] as const;
export type ClassifyPerspective = typeof CLASSIFY_PERSPECTIVES[number];

/**
 * Which cards a count treats as gone (2.0). Sources switch between all three
 * readings, so it is stated per rule and never inferred.
 */
export const COUNT_DEAD_CARDS = ['board', 'hero', 'none'] as const;
export type CountDeadCards = typeof COUNT_DEAD_CARDS[number];

/** The four suits as a count filter names one (2.0); kept here so the conformance test has a tuple. */
export const COUNT_SUITS = ['s', 'h', 'd', 'c'] as const;

/**
 * Where a quiz hand came from (1.8). A `worked_example` is the hand a rule was
 * written from, so its pass is in-sample by construction; `probe` and
 * `held_out` hands were transcribed after a freeze and are the only ones that
 * measure fidelity. `form` says whose cards they are: the source's own
 * (`literal`) or the transcriber's choice for a class the source named
 * (`instantiated`).
 */
export const PROVENANCE_KINDS = ['worked_example', 'probe', 'held_out'] as const;
export type ProvenanceKind = typeof PROVENANCE_KINDS[number];
export const PROVENANCE_FORMS = ['literal', 'instantiated'] as const;
export type ProvenanceForm = typeof PROVENANCE_FORMS[number];

/** What kind of answer a rule asks for: an action, a label, or a number of combinations. */
export const ANSWER_KINDS = ['action', 'classify', 'count'] as const;
export type AnswerKind = typeof ANSWER_KINDS[number];
