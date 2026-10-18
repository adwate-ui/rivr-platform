import { describe, it, expect } from 'vitest';
import { parseHands } from './parse.ts';
import { comboLabel, countCombos } from './comboSet.ts';
import {
    atLeast, bareAceOfSuit, countFilter, flushSuitOf, liveCombos, ofClass, pocketPairs, withDraw,
    type Combo,
} from './onBoard.ts';
import { HAND_CLASSES } from '../ontology/types.ts';
import { cardOrThrow, type Card } from '../cards/cards.ts';

/**
 * Counting a range against a board.
 *
 * Every fixture here is invented for this file, and every expected number is
 * worked out by hand in the comment beside it rather than read back from the
 * code. A counter tested against its own output proves only that it does what
 * it does; tested against arithmetic done independently, it proves the engine
 * and a person counting combinations agree about what a range is.
 */

const cards = (text: string): Card[] => text.split(/\s+/).filter(Boolean).map(cardOrThrow);

/** How many live combinations sit in one grid cell, such as `AJs` or `QQ`. */
const inCell = (combos: readonly Combo[], label: string): number =>
    combos.filter((combo) => comboLabel(combo.cards[0], combo.cards[1]) === label).length;

/**
 * A value-heavy range on a dry jack-high flop. Before the board: QQ-99 is four
 * pairs of 6 (24), AJs and ATs are 4 each (8), KJs 4, AJo 12, so 48 in all.
 */
const RANGE = ['QQ-99', 'AJs-ATs', 'KJs', 'AJo'];
const BOARD = cards('Jc 8d 3s');

describe('preflop totals, with nothing removed', () => {
    it.each([
        // QQ-88 is 5 pairs x 6 = 30; AJs-A9s 3 x 4 = 12; KQs 4; AQo-AJo 2 x 12 = 24.
        ['a tight opening range', ['QQ-88', 'AJs-A9s', 'KQs', 'AQo-AJo'], 70],
        // 77-22 is 6 pairs x 6 = 36; T9s-65s is 5 connectors x 4 = 20; KJo 12.
        ['a speculative calling range', ['77-22', 'T9s-65s', 'KJo'], 68],
        // 99+ is 6 x 6 = 36; A2s+ 12 x 4 = 48; K9s+ 4 x 4 = 16; ATo+ 4 x 12 = 48; KQo 12.
        ['a wide raising range', ['99+', 'A2s+', 'K9s+', 'ATo+', 'KQo'], 160],
    ])('%s is %i combos', (_label, hands, total) => {
        expect(countCombos(parseHands(hands))).toBe(total);
        expect(liveCombos(parseHands(hands), [], 'none')).toHaveLength(total);
    });

    it('finds the pocket pairs in a range', () => {
        // 30 of the tight range's 70 and 36 of the calling range's 68 are pairs.
        expect(pocketPairs(liveCombos(parseHands(['QQ-88', 'AJs-A9s', 'KQs', 'AQo-AJo']), [], 'none'))).toHaveLength(30);
        expect(pocketPairs(liveCombos(parseHands(['77-22', 'T9s-65s', 'KJo']), [], 'none'))).toHaveLength(36);
    });
});

describe('[QQ-99, AJs-ATs, KJs, AJo] on J♣8♦3♠, board dead', () => {
    const live = (): Combo[] => liveCombos(parseHands(RANGE), BOARD, 'board');

    it('is 40 combos once the board is dead, from 48 before it', () => {
        // The J♣ removes three JJ combos (6 -> 3), A♣J♣ from AJs (4 -> 3), K♣J♣
        // from KJs (4 -> 3) and the three AJo combos holding the J♣ (12 -> 9):
        // 48 - 3 - 1 - 1 - 3 = 40. The 8♦ and 3♠ touch nothing in the range.
        expect(countCombos(parseHands(RANGE))).toBe(48);
        expect(live()).toHaveLength(40);
    });

    it('itemises the live combinations cell by cell', () => {
        const combos = live();
        expect(inCell(combos, 'QQ')).toBe(6);
        expect(inCell(combos, 'JJ')).toBe(3);
        expect(inCell(combos, 'TT')).toBe(6);
        expect(inCell(combos, 'AJs')).toBe(3);
        expect(inCell(combos, 'KJs')).toBe(3);
        expect(inCell(combos, 'AJo')).toBe(9);
        expect(inCell(combos, 'ATs')).toBe(4);
    });

    it('counts top pair or better as 24', () => {
        // JJ is a set (3), QQ an overpair (6), and AJs, KJs and AJo are top pair
        // with an ace or king kicker (3 + 3 + 9 = 15): 3 + 6 + 15 = 24.
        expect(atLeast(live(), 'top_pair_weak_kicker')).toHaveLength(24);
        // Nothing here pairs the jack with a weak kicker, so the threshold does
        // not move when the good-kicker rung is named instead.
        expect(atLeast(live(), 'top_pair_good_kicker')).toHaveLength(24);
    });

    it('sorts the rest by class', () => {
        const combos = live();
        // TT and 99 are below the jack: 6 + 6.
        expect(ofClass(combos, ['underpair'])).toHaveLength(12);
        // ATs makes nothing and holds an ace.
        expect(ofClass(combos, ['ace_high'])).toHaveLength(4);
        expect(ofClass(combos, ['overpair'])).toHaveLength(6);
        expect(ofClass(combos, ['set'])).toHaveLength(3);
    });

    it('reports the same thing through countFilter, with the working', () => {
        const outcome = countFilter({
            set: parseHands(RANGE), board: BOARD, dead: 'board',
            filter: { kind: 'hand_class_min', hand_class: 'top_pair_weak_kicker' },
        });
        expect(outcome).toMatchObject({ value: 24, of: 40 });
        expect(outcome.breakdown).toEqual([
            { handClass: 'set', combos: 3 },
            { handClass: 'overpair', combos: 6 },
            { handClass: 'top_pair_good_kicker', combos: 15 },
        ]);
    });

    it('counts everything when asked for the total', () => {
        expect(countFilter({ set: parseHands(RANGE), board: BOARD, dead: 'board', filter: { kind: 'total' } }))
            .toMatchObject({ value: 40, of: 40 });
    });

    it('finds an exact set of classes', () => {
        // Sets and overpairs only: 3 + 6.
        expect(countFilter({
            set: parseHands(RANGE), board: BOARD, dead: 'board',
            filter: { kind: 'hand_class_any', hand_classes: ['set', 'overpair'] },
        })).toMatchObject({ value: 9, of: 40 });
    });

    it('orders the breakdown strongest first, whatever order the classes came in', () => {
        const outcome = countFilter({ set: parseHands(RANGE), board: BOARD, dead: 'board', filter: { kind: 'total' } });
        const order = outcome.breakdown.map((row) => row.handClass);
        const strongestFirst = [...HAND_CLASSES].reverse().filter((handClass) => order.includes(handClass));
        expect(order).toEqual(strongestFirst);
        expect(outcome.breakdown.reduce((sum, row) => sum + row.combos, 0)).toBe(40);
    });
});

describe("which cards are dead is the caller's to say", () => {
    it("removes the hero's own cards only when told to", () => {
        // Q9 is 4 suited + 12 offsuit = 16 combos, none touching K♣7♦2♠. Holding
        // Q♥9♥ removes the four combos with the Q♥, the four with the 9♥, and
        // counts Q♥9♥ once rather than twice: 16 - (4 + 4 - 1) = 9.
        const q9 = parseHands(['Q9s', 'Q9o']);
        const board = cards('Kc 7d 2s');
        const hero = cards('Qh 9h');
        expect(liveCombos(q9, board, 'board', hero)).toHaveLength(16);
        expect(liveCombos(q9, board, 'hero', hero)).toHaveLength(9);
    });

    it('removes nothing at all under "none", even with a board in hand', () => {
        expect(liveCombos(parseHands(RANGE), BOARD, 'none')).toHaveLength(48);
    });
});

describe('the filters asked for by name', () => {
    /** Every ace from AA down to A9, plus KQs: aces of every suit, against a monotone flop. */
    const ACES = parseHands(['AA', 'AKs-A9s', 'AKo-A9o', 'KQs']);

    it('finds the bare ace of a suit on a monotone flop', () => {
        // On Q♠8♠4♠ the bare A♠ is the ace of spades with no second spade:
        // A♠A♥, A♠A♦ and A♠A♣ (3), and A♠ with a red or club K, Q, J, T or 9
        // (5 ranks x 3 suits = 15). A♠X♠ is suited, so never bare: 3 + 15 = 18.
        const monotone = cards('Qs 8s 4s');
        const bare = bareAceOfSuit(liveCombos(ACES, monotone, 'board'), 's');
        expect(bare).toHaveLength(18);
        // None of them is a flush, which is the whole point of "bare".
        expect(bare.every((combo) => combo.handClass !== 'flush')).toBe(true);
        expect(countFilter({
            set: ACES, board: monotone, dead: 'board', filter: { kind: 'bare_ace_of_suit', suit: 's' },
        }).value).toBe(18);
    });

    it('takes the suit from the board when the question names none', () => {
        // A generated monotone flop comes in any suit, so "the bare ace of the
        // suit" has to mean THIS board's suit. On K♦T♦5♦ the same arithmetic
        // gives 18 for the A♦; with the hero's A♣7♣ dead as well, A♦A♣ goes and
        // 17 are left.
        const filter = { kind: 'bare_ace_of_suit' } as const;
        expect(countFilter({ set: ACES, board: cards('Qs 8s 4s'), dead: 'board', filter }).value).toBe(18);
        expect(countFilter({ set: ACES, board: cards('Kd Td 5d'), dead: 'board', filter }).value).toBe(18);
        expect(countFilter({
            set: ACES, board: cards('Kd Td 5d'), dead: 'hero', filter, hero: cards('Ac 7c'),
        }).value).toBe(17);
    });

    it('finds no bare ace where the board has no suit three times', () => {
        expect(flushSuitOf(cards('Jh 8h 3c'))).toBeUndefined();
        expect(flushSuitOf(cards('Jh 8c 3h 2h'))).toBe('h');
        expect(countFilter({
            set: parseHands(['AKo']), board: cards('Jh 8h 3c'), dead: 'board', filter: { kind: 'bare_ace_of_suit' },
        }).value).toBe(0);
    });

    it('does not count the ace of a suit that brings a second one', () => {
        const live = liveCombos(parseHands(['AKs', 'AKo']), cards('Qh 7h 2c'), 'board');
        // A♥K♥ is a flush draw, not a bare ace; A♥ with a black or diamond king is bare.
        expect(bareAceOfSuit(live, 'h')).toHaveLength(3);
    });

    it('finds hands holding a named draw', () => {
        const suited = parseHands(['AKs']);
        const twoTone = cards('Qh 7h 2c');
        expect(withDraw(liveCombos(suited, twoTone, 'board'), ['flush_draw'])).toHaveLength(1);
        expect(countFilter({
            set: suited, board: twoTone, dead: 'board', filter: { kind: 'draw_class_any', draw_classes: ['flush_draw'] },
        }).value).toBe(1);
    });

    it('finds pocket pairs through the filter too', () => {
        // AA-QQ is 18 and AKo 12, so 18 pairs of 30.
        expect(countFilter({ set: parseHands(['AA-QQ', 'AKo']), board: [], dead: 'none', filter: { kind: 'pocket_pairs' } }))
            .toMatchObject({ value: 18, of: 30 });
    });
});
