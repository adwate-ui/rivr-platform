/**
 * Every word the engine speaks about a spot (#138; decision 0016): the tables and sentences of its description,
 * passed in by the app from its own catalogue. English here, for the command line, the gates and the tests.
 */
import { RANK_NAMES, SUIT_NAMES, type RankCode, type SuitCode } from './cards/cards.ts';
import {
    STREET_NAMES, type PlayerCount, type Position, type PostflopFacingState, type PotType, type PreflopFacingState, type RunoutTag, type SprBracket,
    type StackBracket, type Street, type VillainRaiseSize,
} from './ontology/types.ts';

/** The sentences, each with its slots filled by the engine. */
export interface DrillSentences {
    /** "ace of hearts". */
    readonly card: (rank: string, suit: string) => string;
    /** Cards spelled out, one after another. */
    readonly cards: (cards: readonly string[]) => string;
    /** "A 2/5 game." */
    readonly game: (stakes: string) => string;
    /** "Flop. You are on the button with a deep stack in a single-raised pot, heads up." */
    readonly opening: (parts: { street: string; position: string; stack: string; pot?: string | undefined; count?: string | undefined }) => string;
    /** A phrase from a table as its own sentence. */
    readonly sentence: (text: string) => string;
    /** "About ₹600 · 3bb in the middle." */
    readonly middle: (amount: string) => string;
    /** "about ₹600 · 3bb". */
    readonly about: (amount: string) => string;
    readonly board: (cards: string) => string;
    /** "The turn card pairs the board and adds a flush draw." */
    readonly runout: (street: string, changes: readonly string[]) => string;
    /** "Your hand: …", or the opponent's when the question is about theirs. */
    readonly hand: (cards: string, isOpponents: boolean) => string;
    /** "Action so far: you bet the flop, then they called." */
    readonly actions: (steps: readonly string[]) => string;
    /** "you called"; a step with no actor is its bare verb. */
    readonly step: (actor: 'hero' | 'villain' | undefined, verb: string) => string;
    /** "you bet the flop". */
    readonly stepOn: (step: string, street: string) => string;
}

export interface DrillWords {
    readonly ranks: Readonly<Record<RankCode, string>>;
    readonly suits: Readonly<Record<SuitCode, string>>;
    /** The street as a heading: "Flop". */
    readonly streets: Readonly<Record<Street, string>>;
    /** The street inside a sentence: "the flop". */
    readonly streetWords: Readonly<Record<Street, string>>;
    readonly positions: Readonly<Record<Position, string>>;
    readonly stacks: Readonly<Record<StackBracket, string>>;
    readonly spr: Readonly<Record<SprBracket, string>>;
    readonly raiseSizes: Readonly<Record<VillainRaiseSize, string>>;
    readonly pots: Readonly<Record<PotType, string>>;
    readonly counts: Readonly<Record<PlayerCount, string>>;
    readonly preflopFacing: Readonly<Record<PreflopFacingState, string>>;
    readonly postflopFacing: Readonly<Record<PostflopFacingState, string>>;
    readonly runouts: Readonly<Record<RunoutTag, string>>;
    /** A node path step's verb, past tense: "called". A step not listed is printed with its underscores softened. */
    readonly past: Readonly<Record<string, string>>;
    readonly say: DrillSentences;
}

const POSITION_NAMES: Readonly<Record<Position, string>> = {
    UTG: 'under the gun',
    UTG1: 'under the gun plus one',
    UTG2: 'under the gun plus two',
    LJ: 'the lojack',
    HJ: 'the hijack',
    CO: 'the cutoff',
    BTN: 'the button',
    SB: 'the small blind',
    BB: 'the big blind',
};

const STACK_NAMES: Readonly<Record<StackBracket, string>> = {
    short: 'a short stack',
    standard: 'a standard stack',
    deep: 'a deep stack',
    very_deep: 'a very deep stack',
};

const SPR_NAMES: Readonly<Record<SprBracket, string>> = {
    very_low: 'The pot is large next to what is behind',
    low: 'The pot is big next to what is behind',
    medium: 'There is a healthy amount behind',
    high: 'There is a lot behind',
};

const RAISE_SIZE_NAMES: Readonly<Record<VillainRaiseSize, string>> = {
    small: 'The bet is small',
    standard: 'The bet is a standard size',
    large: 'The bet is large',
    all_in: 'The bet is all in',
};

const POT_NAMES: Readonly<Record<PotType, string>> = {
    limped: 'a limped pot',
    single_raised: 'a single-raised pot',
    three_bet: 'a 3-bet pot',
    four_bet_plus: 'a 4-bet pot',
};

const COUNT_NAMES: Readonly<Record<PlayerCount, string>> = {
    heads_up: 'heads up',
    three_way: 'three-way',
    multiway: 'multiway',
};

const PREFLOP_FACING: Readonly<Record<PreflopFacingState, string>> = {
    unopened: 'The pot is unopened.',
    facing_limp: 'There is a limp in front of you.',
    facing_raise: 'You are facing a raise.',
    facing_raise_and_call: 'You are facing a raise and a call.',
    facing_3bet: 'You are facing a 3-bet.',
    facing_4bet: 'You are facing a 4-bet.',
    facing_steal: 'You are facing a late-position steal attempt.',
};

const POSTFLOP_FACING: Readonly<Record<PostflopFacingState, string>> = {
    first_to_act: 'You are first to act.',
    facing_check: 'It is checked to you.',
    facing_bet: 'You are facing a bet.',
    facing_raise: 'You are facing a raise.',
    facing_donk: 'You are facing a lead into the raiser.',
};

const RUNOUT_NAMES: Readonly<Record<RunoutTag, string>> = {
    brick: 'changes little',
    overcard: 'is an overcard',
    pairs_board: 'pairs the board',
    pairs_hero: 'matches one of your cards',
    flush_completing: 'puts a third card of one suit out, so a flush is possible',
    flush_drawing: 'adds a flush draw',
    four_flush: 'puts a fourth card of one suit out',
    straight_completing: 'makes a straight possible',
    straight_completing_low: 'makes a straight possible only for low holdings',
    straight_drawing: 'adds straight draws',
    four_straight: 'puts four to a straight on the board',
};

const PAST: Readonly<Record<string, string>> = {
    bet: 'bet', call: 'called', check: 'checked', raise: 'raised', fold: 'folded',
    limp: 'limped', all_in: 'went all in', '3bet': '3-bet', '4bet': '4-bet',
    three_bet: '3-bet', four_bet: '4-bet',
};

const ENGLISH_SENTENCES: DrillSentences = {
    card: (rank, suit) => `${rank} of ${suit}`,
    cards: (cards) => cards.join(', '),
    game: (stakes) => `A ${stakes} game.`,
    opening: ({ street, position, stack, pot, count }) =>
        `${street}. You are on ${position} with ${stack}${pot === undefined ? '' : ` in ${pot}`}${count === undefined ? '' : `, ${count}`}.`,
    sentence: (text) => `${text}.`,
    middle: (amount) => `${amount.charAt(0).toUpperCase()}${amount.slice(1)} in the middle.`,
    about: (amount) => `about ${amount}`,
    board: (cards) => `Board: ${cards}.`,
    runout: (street, changes) => `The ${street} card ${changes.join(' and ')}.`,
    hand: (cards, isOpponents) => (isOpponents ? `Your opponent's hand: ${cards}.` : `Your hand: ${cards}.`),
    actions: (steps) => `Action so far: ${steps.join(', then ')}.`,
    step: (actor, verb) => (actor === undefined ? verb : `${actor === 'hero' ? 'you' : 'they'} ${verb}`),
    stepOn: (step, street) => `${step} the ${street}`,
};

/** The engine's own English. */
export const ENGLISH_WORDS: DrillWords = {
    ranks: RANK_NAMES, suits: SUIT_NAMES, streets: STREET_NAMES,
    streetWords: { preflop: 'preflop', flop: 'flop', turn: 'turn', river: 'river' },
    positions: POSITION_NAMES, stacks: STACK_NAMES, spr: SPR_NAMES, raiseSizes: RAISE_SIZE_NAMES, pots: POT_NAMES, counts: COUNT_NAMES,
    preflopFacing: PREFLOP_FACING, postflopFacing: POSTFLOP_FACING, runouts: RUNOUT_NAMES, past: PAST, say: ENGLISH_SENTENCES,
};
