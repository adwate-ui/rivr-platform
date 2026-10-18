/**
 * The draws the hero holds: flush and straight, made with the hero's own cards.
 */

import { RANK_VALUE, SUITS, type Card, type SuitCode } from './cards/cards.ts';
import type { DrawClass } from './ontology/types.ts';

const valuesOf = (cards: readonly Card[]): number[] => cards.map((card) => RANK_VALUE[card.rank]);

/** Distinct rank values present, with the ace also counted low. */
function straightSet(values: readonly number[]): Set<number> {
    const set = new Set(values);
    if (set.has(14)) set.add(1);
    return set;
}

/** The five ranks of the straight topped by `top`, descending. */
const windowFrom = (top: number): number[] => [top, top - 1, top - 2, top - 3, top - 4];

/** Does `ranks` contain a five-run that uses at least one rank from `must`? */
function runUsing(ranks: ReadonlySet<number>, must: ReadonlySet<number>): boolean {
    for (let top = 14; top >= 5; top -= 1) {
        const window = windowFrom(top);
        if (window.every((value) => ranks.has(value)) && window.some((value) => must.has(value))) return true;
    }
    return false;
}

/**
 * Ranks that would complete a straight for the hero.
 *
 * "For the hero" is the load-bearing part: a four-card run sitting entirely on
 * the board is everybody's draw and nobody's edge, so a completing rank only
 * counts when the resulting run uses one of the hero's own cards.
 */
function straightOuts(heroValues: readonly number[], boardValues: readonly number[]): number[] {
    const combined = straightSet([...heroValues, ...boardValues]);
    const heroSet = straightSet(heroValues);
    const outs: number[] = [];
    for (let candidate = 2; candidate <= 14; candidate += 1) {
        if (combined.has(candidate)) continue;
        if (runUsing(straightSet([...combined, candidate]), heroSet)) outs.push(candidate);
    }
    return outs;
}

/** Three to a straight inside one five-window, using a hero card: runner-runner. */
function hasBackdoorStraight(heroValues: readonly number[], boardValues: readonly number[]): boolean {
    const combined = straightSet([...heroValues, ...boardValues]);
    const heroSet = straightSet(heroValues);
    for (let top = 14; top >= 5; top -= 1) {
        const present = windowFrom(top).filter((value) => combined.has(value));
        if (present.length === 3 && present.some((value) => heroSet.has(value))) return true;
    }
    return false;
}

function suitCounts(cards: readonly Card[]): Record<SuitCode, number> {
    const counts: Record<SuitCode, number> = { h: 0, d: 0, c: 0, s: 0 };
    cards.forEach((card) => { counts[card.suit] += 1; });
    return counts;
}

/** A flush draw, or on the flop a backdoor one, using a hero card. */
function flushDraw(hole: readonly Card[], board: readonly Card[]): DrawClass | undefined {
    const combinedSuits = suitCounts([...hole, ...board]);
    const heroSuits = suitCounts(hole);
    const heroSuitWith = (count: number): boolean =>
        SUITS.some((suit) => combinedSuits[suit] === count && heroSuits[suit] > 0);
    if (heroSuitWith(4)) return 'flush_draw';
    if (heroSuitWith(3) && board.length === 3) return 'backdoor_flush';
    return undefined;
}

/** An open-ender (two or more outs), a gutshot (one), or on the flop a backdoor straight. */
function straightDraw(hole: readonly Card[], board: readonly Card[]): DrawClass | undefined {
    const outs = straightOuts(valuesOf(hole), valuesOf(board));
    if (outs.length >= 2) return 'open_ended';
    if (outs.length === 1) return 'gutshot';
    if (board.length === 3 && hasBackdoorStraight(valuesOf(hole), valuesOf(board))) return 'backdoor_straight';
    return undefined;
}

/**
 * The draws the hero holds.
 *
 * Draws only exist while a card is still to come, so a five-card board always
 * yields `['none']` — a river "flush draw" is just four cards of a suit and no
 * way to use them. Backdoor draws additionally need TWO cards to come, so they
 * only appear on the flop.
 */
export function classifyDraws(hole: readonly Card[], board: readonly Card[]): DrawClass[] {
    if (board.length >= 5) return ['none'];

    const flush = flushDraw(hole, board);
    const straight = straightDraw(hole, board);
    const draws = [flush, straight].filter((draw): draw is DrawClass => draw !== undefined);
    // A flush draw alongside any straight draw is the combination worth naming;
    // the components stay in the list so a rule keyed on either still matches.
    if (flush === 'flush_draw' && (straight === 'open_ended' || straight === 'gutshot')) draws.push('combo_draw');

    return draws.length > 0 ? draws : ['none'];
}
