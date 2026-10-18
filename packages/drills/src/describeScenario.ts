/**
 * A scenario, in prose.
 *
 * For an ordinary chart the figures live in a table beside it and the
 * `aria-label` is a summary. Here there is no table: **the drawing IS the
 * question**, so this text is the content and not a courtesy. A reader using a
 * screen reader must be able to answer the drill from this sentence alone,
 * which makes it a functional requirement rather than an accessibility nicety.
 *
 * Pure, so the same fixtures test it and the renderer.
 */

import { RANK_NAMES, SUIT_NAMES, type Card } from './cards/cards.ts';
import type {
    PlayerCount, PostflopFacingState, PotType, Position, PreflopFacingState,
    RunoutTag, SprBracket, StackBracket, Stakes, VillainRaiseSize,
} from './ontology/types.ts';
import { POSITION_LABEL, STREET_NAMES } from './ontology/types.ts';
import type { Scenario } from './generator/types.ts';
import { describeStep } from './nodePath.ts';

/**
 * Formats an amount of money for a reader. The amount is in the unit the
 * stakes are written in (the "5" of "2/5" is the big blind), and the caller
 * decides currency and grouping, so this package holds no money format of its
 * own. Learn screens pass the app's formatter.
 */
export type MoneyFormatter = (amount: number) => string;

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

/**
 * Stack-to-pot, in words. The source's own brackets decide the boundaries, so
 * this says which bracket rather than inventing a ratio it never gave.
 */
const SPR_NAMES: Readonly<Record<SprBracket, string>> = {
    very_low: 'The pot is large next to what is behind',
    low: 'The pot is big next to what is behind',
    medium: 'There is a healthy amount behind',
    high: 'There is a lot behind',
};

/** How big the bet in front of you is. */
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

/**
 * What the card that just landed did, as a verb phrase after "The turn card…".
 *
 * The runout is read by the matcher, counted by the ranker, sampled by the
 * generator — and until this map it was spoken nowhere, so the coordinate that
 * often decides the answer was missing from the question. `Record<RunoutTag, …>`
 * so a new tag without a phrase is a compile error, not a silent gap.
 */
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

/** "ace of hearts". Spelled out, because "Ah" is read aloud as a word. */
export function describeCard(card: Card): string {
    return `${RANK_NAMES[card.rank]} of ${SUIT_NAMES[card.suit]}`;
}

/** Several cards, spelled out and separated for a screen reader. */
export function describeCards(cards: readonly Card[]): string {
    return cards.map(describeCard).join(', ');
}

/**
 * The game, the street, the seat, the stack and the pot. The game comes first,
 * because the same spot can have different answers at different stakes: it is
 * sampled, matched and used to pick the governing rule, so a screen-reader user
 * must hear it as part of the question.
 *
 * An unopened preflop pot is not yet any kind of pot and has nobody in it to
 * count, so neither is said: "with a standard stack. The pot is unopened."
 * Saying "in a limped pot, three-way" there contradicted the sentence that
 * followed it.
 */
function openingSentence(scenario: Scenario): string {
    const game = scenario.stakes === undefined ? '' : `A ${scenario.stakes} game. `;
    const unopened = scenario.street === 'preflop' && scenario.preflopFacingState === 'unopened';
    const pot = scenario.potType === undefined ? '' : ` in ${POT_NAMES[scenario.potType]}`;
    const company = unopened ? '' : `, ${COUNT_NAMES[scenario.playerCount]}`;
    return `${game}${STREET_NAMES[scenario.street]}. You are on ${POSITION_NAMES[scenario.heroPosition]} `
        + `with ${STACK_NAMES[scenario.stackBracket]}${pot}${company}.`;
}

/** Stack-to-pot in words, and roughly what is in the middle. */
function potSentences(scenario: Scenario, formatMoney: MoneyFormatter): string[] {
    const parts: string[] = [];
    if (scenario.sprBracket !== undefined) parts.push(`${SPR_NAMES[scenario.sprBracket]}.`);
    const inTheMiddle = potLabel(scenario, formatMoney);
    if (inTheMiddle !== undefined) {
        parts.push(`${inTheMiddle.charAt(0).toUpperCase()}${inTheMiddle.slice(1)} in the middle.`);
    }
    return parts;
}

/**
 * The board, what the latest card changed, and the hand. Rules key on the
 * runout (`runout_any`, `runout_exclude`), so leaving it unspoken asked a
 * question with half its premise missing: "board: jack, eight, three, six"
 * does not tell a listener whether that six brought anything in.
 *
 * Whose hand, not "Your hand" unconditionally: telling a reader a hand is
 * theirs when the question is about the opponent's holding makes the spot
 * unanswerable in a way they cannot see.
 */
function cardSentences(scenario: Scenario): string[] {
    const parts: string[] = [];
    if (scenario.board.length > 0) parts.push(`Board: ${describeCards(scenario.board)}.`);
    const runouts = scenario.runouts ?? [];
    if (scenario.board.length > 3 && runouts.length > 0) {
        const streetWord = scenario.board.length === 4 ? 'turn' : 'river';
        parts.push(`The ${streetWord} card ${runouts.map((tag) => RUNOUT_NAMES[tag]).join(' and ')}.`);
    }
    parts.push(scenario.holder === 'villain'
        ? `Your opponent's hand: ${describeCards(scenario.hole)}.`
        : `Your hand: ${describeCards(scenario.hole)}.`);
    return parts;
}

/**
 * What happened before this decision, and what the hero now faces.
 *
 * Spoken as well as drawn: "what happened before" is half the question, and WHO
 * did it is the other half. "You bet the flop, then they called" is a barrel,
 * "they bet the flop, then you called" is a call-down. The size of the bet is
 * said too: without it a rule scoped to `all_in` and one scoped to `small` read
 * as the identical question, while the size often decided which rule answered.
 */
function actionSentences(scenario: Scenario): string[] {
    const parts: string[] = [];
    if (scenario.nodePath.length > 0) {
        const spoken = scenario.nodePath.map((step) => {
            const { street, text } = describeStep(step);
            return street === undefined ? text : `${text} the ${street}`;
        });
        parts.push(`Action so far: ${spoken.join(', then ')}.`);
    }
    if (scenario.preflopFacingState !== undefined) parts.push(PREFLOP_FACING[scenario.preflopFacingState]);
    if (scenario.postflopFacingState !== undefined) parts.push(POSTFLOP_FACING[scenario.postflopFacingState]);
    if (scenario.villainRaiseSize !== undefined) parts.push(`${RAISE_SIZE_NAMES[scenario.villainRaiseSize]}.`);
    return parts;
}

/** The whole spot as prose: a screen-reader user must be able to answer the drill from it alone. */
export function describeScenario(scenario: Scenario, formatMoney: MoneyFormatter): string {
    return [
        openingSentence(scenario),
        ...potSentences(scenario, formatMoney),
        ...cardSentences(scenario),
        ...actionSentences(scenario),
    ].join(' ');
}

/**
 * Roughly what is in the pot, as a player would say it: money and blinds,
 * with the "about" the estimate deserves. The questions on this screen are
 * call, fold and how-much questions, and the pot is the number they are all
 * priced against.
 */
export function potLabel(scenario: Scenario, formatMoney: MoneyFormatter): string | undefined {
    if (scenario.potBb === undefined) return undefined;
    const blinds = scenario.potBb;
    const bigBlind = bigBlindOf(scenario.stakes);
    if (bigBlind === undefined) return `about ${blinds}bb`;
    return `about ${formatMoney(blinds * bigBlind)} · ${blinds}bb`;
}

/** The big blind the stakes name — "2/5" is a 5 big blind. Undefined where the spot states no stakes. */
export const bigBlindOf = (stakes: Stakes | undefined): number | undefined =>
    (stakes === undefined ? undefined : Number(stakes.split('/')[1]));

/**
 * The effective stack as a player would say it: money, and blinds.
 *
 * A bracket is what the RULE reads. "Deep" is not a number you can count out in
 * front of you, and decisions such as whether to set-mine or whether a barrel
 * commits you are made against a number. Returns undefined rather than a guess
 * when the spot never stated one. Money is written by the caller's formatter,
 * so the product shows one currency, and the stakes label ("2/5") still says
 * which game this is.
 */
export function stackLabel(scenario: Scenario, formatMoney: MoneyFormatter): string | undefined {
    if (scenario.effectiveStackBb === undefined) return undefined;
    const blinds = scenario.effectiveStackBb;
    const bigBlind = bigBlindOf(scenario.stakes);
    if (bigBlind === undefined) return `${blinds}bb`;
    return `${formatMoney(blinds * bigBlind)} · ${blinds}bb`;
}

/** The short form, for a heading above the drawing. */
export function describeShort(scenario: Scenario): string {
    const game = scenario.stakes === undefined ? [] : [scenario.stakes];
    const pot = scenario.potType === undefined ? [] : [POT_NAMES[scenario.potType]];
    return [
        ...game,
        STREET_NAMES[scenario.street],
        POSITION_LABEL[scenario.heroPosition],
        ...pot,
    ].join(' · ');
}
