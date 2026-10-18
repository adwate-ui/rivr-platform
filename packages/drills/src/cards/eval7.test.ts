import { describe, it, expect } from 'vitest';
import { DECK, RANK_VALUE, parseCard, type Card } from './cards.ts';
import { makeRng } from '../prng.ts';
import {
    evaluate,
    unpack,
    categoryOf,
    HAND_CATEGORY,
    CATEGORY_NAMES,
    NotEnoughCardsError,
    type HandCategory,
} from './eval7.ts';

/**
 * The hand evaluator.
 *
 * `evaluate` takes a categorical shortcut: it counts ranks and suits once and
 * reads the answer off those counts, rather than scoring all C(7,5) = 21
 * five-card subsets. That is 21× faster and it is the reason `relativeStrength`
 * is affordable at all — but it is also a claim, and the claim is what the
 * cross-check below tests. A hand-written case list would only ever cover the
 * situations somebody thought of; the brute-force reference covers the ones
 * nobody did.
 */

const hand = (notation: string): Card[] =>
    (notation.match(/.{2}/g) ?? []).map((text) => {
        const card = parseCard(text);
        if (card === null) throw new Error(`bad test fixture: ${text}`);
        return card;
    });

/* ── an independent reference implementation ─────────────────────────────── */

function referenceStraightTop(values: readonly number[]): number {
    const distinct = new Set(values);
    if (distinct.has(14)) distinct.add(1);
    for (let top = 14; top >= 5; top -= 1) {
        if ([0, 1, 2, 3, 4].every((offset) => distinct.has(top - offset))) return top;
    }
    return 0;
}

/** Scores EXACTLY five cards, by a different route than the module under test. */
function scoreFive(cards: readonly Card[]): number {
    const values = cards.map((card) => RANK_VALUE[card.rank]).sort((a, b) => b - a);
    const flush = new Set(cards.map((card) => card.suit)).size === 1;
    const top = referenceStraightTop(values);

    const byCount = new Map<number, number>();
    values.forEach((value) => byCount.set(value, (byCount.get(value) ?? 0) + 1));
    const groups = [...byCount.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const shape = groups.map(([, count]) => count).join('');
    const ordered = groups.map(([value]) => value);

    const pack = (category: HandCategory, tiebreaks: number[]): number => {
        let score: number = category;
        for (let i = 0; i < 5; i += 1) score = score * 16 + (tiebreaks[i] ?? 0);
        return score;
    };

    if (flush && top > 0) return pack(HAND_CATEGORY.STRAIGHT_FLUSH, [top]);
    if (shape === '41') return pack(HAND_CATEGORY.QUADS, ordered);
    if (shape === '32') return pack(HAND_CATEGORY.FULL_HOUSE, ordered);
    if (flush) return pack(HAND_CATEGORY.FLUSH, values);
    if (top > 0) return pack(HAND_CATEGORY.STRAIGHT, [top]);
    if (shape === '311') return pack(HAND_CATEGORY.TRIPS, ordered);
    if (shape === '221') return pack(HAND_CATEGORY.TWO_PAIR, ordered);
    if (shape === '2111') return pack(HAND_CATEGORY.PAIR, ordered);
    return pack(HAND_CATEGORY.HIGH_CARD, values);
}

/** Best five of however many, the slow and obviously-correct way. */
function bruteForce(cards: readonly Card[]): number {
    let best = -1;
    const choose = (start: number, picked: Card[]): void => {
        if (picked.length === 5) {
            best = Math.max(best, scoreFive(picked));
            return;
        }
        cards.slice(start).forEach((card, offset) => choose(start + offset + 1, [...picked, card]));
    };
    choose(0, []);
    return best;
}

/* ── the cross-check ─────────────────────────────────────────────────────── */

describe('against a brute-force best-of-21 reference', () => {
    it.each([5, 6, 7])('agrees on 4,000 random %i-card hands', (size) => {
        const rng = makeRng(20260821 + size);
        for (let trial = 0; trial < 4_000; trial += 1) {
            const cards = hand(rng.shuffle(DECK).slice(0, size).join(''));
            expect(evaluate(cards), cards.map((c) => c.rank + c.suit).join('')).toBe(bruteForce(cards));
        }
    });
});

/* ── the cases that explain what the evaluator means ─────────────────────── */

describe('category ordering', () => {
    const examples: [string, string, HandCategory][] = [
        ['straight flush', '9h8h7h6h5h2c2d', HAND_CATEGORY.STRAIGHT_FLUSH],
        ['quads', 'AhAdAcAs9h2c3d', HAND_CATEGORY.QUADS],
        ['full house', 'AhAdAc9h9d2c3d', HAND_CATEGORY.FULL_HOUSE],
        ['flush', 'Ah9h7h4h2h3c5d', HAND_CATEGORY.FLUSH],
        ['straight', '9h8d7c6s5h2c3d', HAND_CATEGORY.STRAIGHT],
        ['trips', 'AhAdAc9h7d2c3s', HAND_CATEGORY.TRIPS],
        ['two pair', 'AhAd9h9d7c2s3h', HAND_CATEGORY.TWO_PAIR],
        ['pair', 'AhAd9h7d5c2s3h', HAND_CATEGORY.PAIR],
        // No 4, so the wheel does not complete — an earlier version of this
        // fixture read A-5-4-3-2 and was a straight, which the brute-force
        // cross-check caught and the eye did not.
        ['high card', 'Ah9d7c5s3h2dJc', HAND_CATEGORY.HIGH_CARD],
    ];

    it.each(examples)('recognises a %s', (_label, notation, expected) => {
        expect(categoryOf(evaluate(hand(notation)))).toBe(expected);
    });

    it('ranks the categories in the order poker does', () => {
        const scores = examples.map(([, notation]) => evaluate(hand(notation)));
        scores.slice(1).forEach((score, i) => {
            expect(scores[i]).toBeGreaterThan(score);
        });
    });

    it('names every category, so a grade can be explained', () => {
        Object.values(HAND_CATEGORY).forEach((category) => {
            expect(CATEGORY_NAMES[category]).toBeTruthy();
        });
    });
});

describe('straights, including the ones that get miscounted', () => {
    it('reads A-5-4-3-2 as a five-high straight, not an ace-high anything', () => {
        const { category, tiebreaks } = unpack(evaluate(hand('Ah5d4c3s2h9d7c')));
        expect(category).toBe(HAND_CATEGORY.STRAIGHT);
        expect(tiebreaks[0]).toBe(5);
    });

    it('reads the steel wheel as a straight flush topped by the five', () => {
        const { category, tiebreaks } = unpack(evaluate(hand('Ah5h4h3h2h9d7c')));
        expect(category).toBe(HAND_CATEGORY.STRAIGHT_FLUSH);
        expect(tiebreaks[0]).toBe(5);
    });

    it('prefers the higher straight when both are present', () => {
        // 9 through 5 and the wheel both complete; the nine-high must win.
        expect(unpack(evaluate(hand('9h8d7c6s5h4d3c'))).tiebreaks[0]).toBe(9);
    });

    it('ranks Broadway above every other straight', () => {
        expect(evaluate(hand('AhKdQcJsTh2c3d'))).toBeGreaterThan(evaluate(hand('KhQdJcTs9h2c3d')));
    });

    it('does not read four to a straight as a straight', () => {
        expect(categoryOf(evaluate(hand('9h8d7c6s2h3c4d')))).not.toBe(HAND_CATEGORY.STRAIGHT);
    });
});

describe('flushes', () => {
    it('takes the top five when six or seven of a suit are present', () => {
        const { tiebreaks } = unpack(evaluate(hand('AhKhQhJh9h8h7h')));
        // Not a straight flush: A-K-Q-J-9 has a gap. Top five ranks, no 8 or 7.
        expect(tiebreaks).toEqual([14, 13, 12, 11, 9]);
    });

    it('beats a straight and loses to a full house', () => {
        const flush = evaluate(hand('Ah9h7h4h2h3c5d'));
        expect(flush).toBeGreaterThan(evaluate(hand('9h8d7c6s5h2c3d')));
        expect(flush).toBeLessThan(evaluate(hand('AhAdAc9h9d2c3d')));
    });

    it('does not call four to a flush a flush', () => {
        expect(categoryOf(evaluate(hand('Ah9h7hJh2c3d5s')))).toBe(HAND_CATEGORY.HIGH_CARD);
    });
});

describe('the counting cases that only appear with seven cards', () => {
    it('makes a full house from two sets of trips, using the higher as the trips', () => {
        const { category, tiebreaks } = unpack(evaluate(hand('9h9d9c5h5d5s2c')));
        expect(category).toBe(HAND_CATEGORY.FULL_HOUSE);
        expect(tiebreaks[0]).toBe(9);
        expect(tiebreaks[1]).toBe(5);
    });

    it('picks the best two of three pairs, and the best kicker from what is left', () => {
        const { category, tiebreaks } = unpack(evaluate(hand('AhAdKhKd5c5s9h')));
        expect(category).toBe(HAND_CATEGORY.TWO_PAIR);
        expect(tiebreaks.slice(0, 3)).toEqual([14, 13, 9]);
    });

    it('gives quads the single best kicker available', () => {
        const { tiebreaks } = unpack(evaluate(hand('7h7d7c7s2h3dKc')));
        expect(tiebreaks.slice(0, 2)).toEqual([7, 13]);
    });

    it('counterfeits a two pair when the board pairs higher', () => {
        // Hero holds 3-2 on a board that pairs aces and kings: the hole cards
        // stop playing and the hand is aces-and-kings with an ace kicker.
        const { category, tiebreaks } = unpack(evaluate(hand('3h2dAhAdKhKcQs')));
        expect(category).toBe(HAND_CATEGORY.TWO_PAIR);
        expect(tiebreaks.slice(0, 3)).toEqual([14, 13, 12]);
    });

    it('lets the board play when it is better than anything the hole cards add', () => {
        const board = hand('AhKhQhJhTh');
        const withJunk = evaluate([...board, ...hand('2c3d')]);
        expect(withJunk).toBe(evaluate(board));
        expect(categoryOf(withJunk)).toBe(HAND_CATEGORY.STRAIGHT_FLUSH);
    });
});

describe('packing', () => {
    it('round-trips through unpack', () => {
        const score = evaluate(hand('AhAdKhKd5c5s9h'));
        const { category, tiebreaks } = unpack(score);
        let rebuilt: number = category;
        tiebreaks.forEach((value) => { rebuilt = rebuilt * 16 + value; });
        expect(rebuilt).toBe(score);
    });

    it('stays inside a safe integer for the strongest possible hand', () => {
        expect(evaluate(hand('AhKhQhJhTh9h8h'))).toBeLessThan(Number.MAX_SAFE_INTEGER);
    });
});

describe('refusing to guess', () => {
    it.each([0, 1, 4])('throws on %i cards rather than ranking an incomplete hand', (count) => {
        expect(() => evaluate(hand(DECK.slice(0, count).join('')))).toThrow(NotEnoughCardsError);
    });
});
