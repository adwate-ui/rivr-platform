/**
 * A preflop range, counted against a board.
 *
 * This is the arithmetic hand reading is built out of: take the hands an
 * opponent can hold, remove the ones the board and your own cards make
 * impossible, and count what is left by category.
 *
 * Everything here is derived from parts the engine already has —
 * `expandRangeSets` for the range, `classifyMadeHand` for the category,
 * `HAND_CLASSES` for the ordering. Standard range notation is parsed as
 * written, board removal is done combination by combination, and "top pair or
 * better" falls out of the existing class order as a threshold. A count filter
 * is a question about vocabulary the engine already speaks, not a second
 * classifier.
 *
 * Cost: at most 1,326 `classifyMadeHand` calls per count, each categorical and
 * allocation-light, so no cache and no memoisation. A drill asks one of these
 * at a time.
 */

import { HAND_CLASSES, type DrawClass, type HandClass } from '../ontology/types.ts';
import { classifyMadeHand } from '../handClass.ts';
import type { Card, SuitCode } from '../cards/cards.ts';
import { combosToList, type ComboSet } from './comboSet.ts';

/** `HAND_CLASSES` is strongest last, so a threshold is an index comparison. */
const classRank = (handClass: HandClass): number => HAND_CLASSES.indexOf(handClass);

/** One combination in the range, with what it makes on this board. */
export interface Combo {
    readonly cards: readonly [Card, Card];
    readonly handClass: HandClass;
    readonly draws: readonly DrawClass[];
}

/**
 * Which cards are unavailable.
 *
 * `board` alone is the count a reader can do from the felt without looking at
 * their own hand; `hero` additionally removes the two cards they hold; `none`
 * counts the range as dealt. Sources move between these readings freely, so the
 * choice is never inferred here. It is stated by whoever asks for the count.
 */
export type DeadCards = 'board' | 'hero' | 'none';

const key = (card: Card): string => `${card.rank}${card.suit}`;

/**
 * The combinations in `set` that are still possible.
 *
 * Board cards are removed under `board` and `hero`; the hero's two cards only
 * under `hero`. Under `none` the range is counted as dealt, which is what a
 * preflop total ("this range is 120 combinations") means.
 */
export function liveCombos(
    set: ComboSet,
    board: readonly Card[],
    dead: DeadCards,
    hero: readonly Card[] = [],
): Combo[] {
    const blocked = new Set<string>();
    if (dead !== 'none') for (const card of board) blocked.add(key(card));
    if (dead === 'hero') for (const card of hero) blocked.add(key(card));

    const out: Combo[] = [];
    for (const [a, b] of combosToList(set)) {
        if (blocked.has(key(a)) || blocked.has(key(b))) continue;
        // A made hand needs a board; preflop totals are counted without one.
        if (board.length === 0) {
            out.push({ cards: [a, b], handClass: 'no_pair', draws: ['none'] });
            continue;
        }
        const made = classifyMadeHand([a, b], board);
        out.push({ cards: [a, b], handClass: made.handClass, draws: made.draws });
    }
    return out;
}

/** Combinations making at least `floor`, by the ordering in `HAND_CLASSES`. */
export const atLeast = (combos: readonly Combo[], floor: HandClass): Combo[] =>
    combos.filter((combo) => classRank(combo.handClass) >= classRank(floor));

/** Combinations making any of the named classes exactly. */
export const ofClass = (combos: readonly Combo[], classes: readonly HandClass[]): Combo[] =>
    combos.filter((combo) => classes.includes(combo.handClass));

/** Combinations holding any of the named draws. */
export const withDraw = (combos: readonly Combo[], draws: readonly DrawClass[]): Combo[] =>
    combos.filter((combo) => combo.draws.some((draw) => draws.includes(draw)));

/** Pocket pairs. Counted preflop as often as postflop. */
export const pocketPairs = (combos: readonly Combo[]): Combo[] =>
    combos.filter((combo) => combo.cards[0].rank === combo.cards[1].rank);

/**
 * Hands holding the ace of one suit and no second card of it.
 *
 * Asked for by name in hand reading: on a monotone flop the bare ace of the
 * suit is the hand that is neither a flush nor dead against one. A hand with
 * two of the suit is a flush and is counted somewhere else, which is why the
 * second card is excluded here rather than left to the caller.
 */
export function bareAceOfSuit(combos: readonly Combo[], suit: SuitCode): Combo[] {
    // Stated as "exactly one card of the suit, and it is the ace" rather than
    // "holds the ace, and the other card is not of the suit". The two are the
    // same set, but the second has to ask WHICH card is the ace, and a
    // combination always lists its higher rank first — so the branch for an ace
    // in second place is unreachable, and an unreachable branch is a claim
    // nobody can check.
    return combos.filter((combo) => {
        const ofSuit = combo.cards.filter((card) => card.suit === suit);
        return ofSuit.length === 1 && ofSuit[0]?.rank === 'A';
    });
}

/**
 * The suit a board has three or more of, where it has one.
 *
 * What "the flush suit" means when a count rule names none. A generated
 * monotone flop comes in any suit, and a rule that fixed hearts would ask about
 * the A♥ on a board of spades, so the question takes its suit from the cards.
 */
export function flushSuitOf(board: readonly Card[]): SuitCode | undefined {
    const counts = new Map<SuitCode, number>();
    for (const card of board) counts.set(card.suit, (counts.get(card.suit) ?? 0) + 1);
    return [...counts.entries()].find(([, count]) => count >= 3)?.[0];
}

/** How a count question narrows the range. Exactly one shape per question. */
export type CountFilter =
    | { readonly kind: 'total' }
    | { readonly kind: 'hand_class_min'; readonly hand_class: HandClass }
    | { readonly kind: 'hand_class_any'; readonly hand_classes: readonly HandClass[] }
    | { readonly kind: 'draw_class_any'; readonly draw_classes: readonly DrawClass[] }
    /** No `suit`: the one the board has three of (`flushSuitOf`). */
    | { readonly kind: 'bare_ace_of_suit'; readonly suit?: SuitCode }
    | { readonly kind: 'pocket_pairs' };

/** What a count question answers: the number, what it is out of, and the working. */
export interface CountOutcome {
    /** Combinations matching the filter. */
    readonly value: number;
    /** Combinations in the range that are still possible at all. */
    readonly of: number;
    /** The matching combinations by hand class, strongest first, empty classes omitted. */
    readonly breakdown: readonly { readonly handClass: HandClass; readonly combos: number }[];
}

/** What to count: a range, the board it meets, which cards are dead, and the filter. */
export interface CountQuery {
    readonly set: ComboSet;
    readonly board: readonly Card[];
    readonly dead: DeadCards;
    readonly filter: CountFilter;
    /** The hero's two cards, removed only under `dead: 'hero'`. */
    readonly hero?: readonly Card[] | undefined;
}

/** Answers a count question: how many live combinations pass the filter, out of how many, by class. */
export function countFilter(query: CountQuery): CountOutcome {
    const { set, board, dead, filter, hero = [] } = query;
    const live = liveCombos(set, board, dead, hero);
    const matched = applyFilter(live, filter, board);

    const byClass = new Map<HandClass, number>();
    for (const combo of matched) byClass.set(combo.handClass, (byClass.get(combo.handClass) ?? 0) + 1);

    return {
        value: matched.length,
        of: live.length,
        breakdown: [...HAND_CLASSES].reverse().flatMap((handClass) => {
            const combos = byClass.get(handClass);
            return combos === undefined ? [] : [{ handClass, combos }];
        }),
    };
}

function applyFilter(live: readonly Combo[], filter: CountFilter, board: readonly Card[]): Combo[] {
    switch (filter.kind) {
        case 'total': return [...live];
        case 'hand_class_min': return atLeast(live, filter.hand_class);
        case 'hand_class_any': return ofClass(live, filter.hand_classes);
        case 'draw_class_any': return withDraw(live, filter.draw_classes);
        case 'bare_ace_of_suit': {
            // A board with no flush suit has no "bare ace of the suit", and
            // counting one anyway would pick a suit nobody asked about. The
            // validator refuses a suitless rule that can reach such a board;
            // this is what an unvalidated one gets: nothing.
            const suit = filter.suit ?? flushSuitOf(board);
            return suit === undefined ? [] : bareAceOfSuit(live, suit);
        }
        case 'pocket_pairs': return pocketPairs(live);
    }
}
