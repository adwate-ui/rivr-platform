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

import type { Card } from './cards/cards.ts';
import type { Stakes } from './ontology/types.ts';
import { POSITION_LABEL, STREET_NAMES } from './ontology/types.ts';
import type { Scenario } from './generator/types.ts';
import { describeStep } from './nodePath.ts';
import { ENGLISH_WORDS, type DrillWords } from './words.ts';

/**
 * Formats an amount of money for a reader. The amount is in the unit the
 * stakes are written in (the "5" of "2/5" is the big blind), and the caller
 * decides currency and grouping, so this package holds no money format of its
 * own. Learn screens pass the app's formatter.
 */
export type MoneyFormatter = (amount: number) => string;

/**
 * Stack-to-pot, in words. The source's own brackets decide the boundaries, so
 * this says which bracket rather than inventing a ratio it never gave.
 */
/** How big the bet in front of you is. */
/**
 * What the card that just landed did, as a verb phrase after "The turn card…".
 *
 * The runout is read by the matcher, counted by the ranker, sampled by the
 * generator — and until this map it was spoken nowhere, so the coordinate that
 * often decides the answer was missing from the question. `Record<RunoutTag, …>`
 * so a new tag without a phrase is a compile error, not a silent gap.
 */
/** "ace of hearts". Spelled out, because "Ah" is read aloud as a word. */
export function describeCard(card: Card, words: DrillWords = ENGLISH_WORDS): string {
    return words.say.card(words.ranks[card.rank], words.suits[card.suit]);
}

/** Several cards, spelled out and separated for a screen reader. */
export function describeCards(cards: readonly Card[], words: DrillWords = ENGLISH_WORDS): string {
    return words.say.cards(cards.map((card) => describeCard(card, words)));
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
function openingSentences(scenario: Scenario, words: DrillWords): string[] {
    const game = scenario.stakes === undefined ? [] : [words.say.game(scenario.stakes)];
    const unopened = scenario.street === 'preflop' && scenario.preflopFacingState === 'unopened';
    return [...game, words.say.opening({
        street: words.streets[scenario.street], position: words.positions[scenario.heroPosition], stack: words.stacks[scenario.stackBracket],
        pot: scenario.potType === undefined ? undefined : words.pots[scenario.potType],
        count: unopened ? undefined : words.counts[scenario.playerCount],
    })];
}

/** Stack-to-pot in words, and roughly what is in the middle. */
function potSentences(scenario: Scenario, formatMoney: MoneyFormatter, words: DrillWords): string[] {
    const parts: string[] = [];
    if (scenario.sprBracket !== undefined) parts.push(words.say.sentence(words.spr[scenario.sprBracket]));
    const inTheMiddle = potLabel(scenario, formatMoney, words);
    if (inTheMiddle !== undefined) parts.push(words.say.middle(inTheMiddle));
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
function cardSentences(scenario: Scenario, words: DrillWords): string[] {
    const parts: string[] = [];
    if (scenario.board.length > 0) parts.push(words.say.board(describeCards(scenario.board, words)));
    const runouts = scenario.runouts ?? [];
    if (scenario.board.length > 3 && runouts.length > 0) {
        parts.push(words.say.runout(words.streetWords[scenario.board.length === 4 ? 'turn' : 'river'], runouts.map((tag) => words.runouts[tag])));
    }
    parts.push(words.say.hand(describeCards(scenario.hole, words), scenario.holder === 'villain'));
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
function actionSentences(scenario: Scenario, words: DrillWords): string[] {
    const parts: string[] = [];
    if (scenario.nodePath.length > 0) {
        parts.push(words.say.actions(scenario.nodePath.map((step) => {
            const { street, text } = describeStep(step, words);
            return street === undefined ? text : words.say.stepOn(text, words.streetWords[street]);
        })));
    }
    if (scenario.preflopFacingState !== undefined) parts.push(words.preflopFacing[scenario.preflopFacingState]);
    if (scenario.postflopFacingState !== undefined) parts.push(words.postflopFacing[scenario.postflopFacingState]);
    if (scenario.villainRaiseSize !== undefined) parts.push(words.say.sentence(words.raiseSizes[scenario.villainRaiseSize]));
    return parts;
}

/** The whole spot as prose: a screen-reader user must be able to answer the drill from it alone. */
export function describeScenario(scenario: Scenario, formatMoney: MoneyFormatter, words: DrillWords = ENGLISH_WORDS): string {
    return [
        ...openingSentences(scenario, words),
        ...potSentences(scenario, formatMoney, words),
        ...cardSentences(scenario, words),
        ...actionSentences(scenario, words),
    ].join(' ');
}

/**
 * Roughly what is in the pot, as a player would say it: money and blinds,
 * with the "about" the estimate deserves. The questions on this screen are
 * call, fold and how-much questions, and the pot is the number they are all
 * priced against.
 */
export function potLabel(scenario: Scenario, formatMoney: MoneyFormatter, words: DrillWords = ENGLISH_WORDS): string | undefined {
    if (scenario.potBb === undefined) return undefined;
    const blinds = scenario.potBb;
    const bigBlind = bigBlindOf(scenario.stakes);
    if (bigBlind === undefined) return words.say.about(`${blinds}bb`);
    return words.say.about(`${formatMoney(blinds * bigBlind)} · ${blinds}bb`);
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
    const pot = scenario.potType === undefined ? [] : [ENGLISH_WORDS.pots[scenario.potType]];
    return [
        ...game,
        STREET_NAMES[scenario.street],
        POSITION_LABEL[scenario.heroPosition],
        ...pot,
    ].join(' · ');
}
