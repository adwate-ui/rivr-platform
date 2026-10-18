import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { DECK, cardOrThrow, cardsOrThrow as cards } from './cards/cards.ts';
import { RELATIVE_STRENGTHS, type RelativeStrength } from './ontology/types.ts';
import { makeRng } from './prng.ts';
import { BadHoleCardsError } from './handClass.ts';
import {
    handPercentile,
    bucketPercentile,
    classifyRelativeStrength,
    STRENGTH_THRESHOLDS,
} from './relativeStrength.ts';

/**
 * Board-relative hand strength.
 *
 * Too expensive to sweep exhaustively — ~1,100 evaluations a call, against
 * 134,459 distinct rivers — so this is the one classifier tested by a SAMPLE
 * rather than by enumeration: 5,000 seeded (hole, board) pairs behind one
 * digest, plus the anchors below. The anchors are what make a digest failure
 * interpretable; the digest is what covers the 129,000 boards no anchor names.
 */

const pct = (hole: string, board: string): number =>
    handPercentile(cards(hole), cards(board));

describe('the anchors', () => {
    it('gives an unbeatable hand the top of the range', () => {
        // Royal flush: nothing ties it and nothing beats it.
        expect(pct('AhKh', 'QhJhTh')).toBe(1);
    });

    it('gives everyone the same number when the board is the whole hand', () => {
        // A royal on the board: every possible holding ties, so nobody is ahead.
        expect(pct('2c3d', 'AhKhQhJhTh')).toBe(1);
    });

    it('puts the nut flush near the top of a monotone board', () => {
        expect(pct('AhKh', 'Qh7h2h')).toBeGreaterThan(0.95);
    });

    it('puts a hand with nothing near the bottom of a broadway board', () => {
        expect(pct('7h2d', 'AcKhQs')).toBeLessThan(0.3);
    });

    it('rates a small pocket pair well above air, underpair though it is', () => {
        // Worth pinning because the intuition runs the other way: deuces on
        // A-K-Q feels like nothing, and still beats every hand that missed.
        expect(pct('2h2d', 'AcKhQs')).toBeGreaterThan(pct('7h2d', 'AcKhQs'));
        expect(pct('2h2d', 'AcKhQs')).toBeGreaterThan(0.5);
    });

    it('ranks a set above two pair above top pair above nothing, on one board', () => {
        const board = 'Ac7h2s';
        const set = pct('AhAd', board);
        const twoPair = pct('Ah7d', board);
        const topPair = pct('AhKd', board);
        const nothing = pct('Qh9d', board);
        expect(set).toBeGreaterThan(twoPair);
        expect(twoPair).toBeGreaterThan(topPair);
        expect(topPair).toBeGreaterThan(nothing);
    });

    it('drops a hand as the board gets more dangerous for it', () => {
        // An overpair is strong on a dry flop and much less so once four to a
        // flush and four to a straight are out.
        expect(pct('QhQd', '7c4h2s')).toBeGreaterThan(pct('QhQd', '7c4h2sJh9h'));
    });

    it('is symmetric in the order the hole cards arrive', () => {
        expect(pct('AhKd', 'Qc7h2s')).toBe(pct('KdAh', 'Qc7h2s'));
    });

    it('always lands inside [0, 1]', () => {
        [pct('AhKh', 'QhJhTh'), pct('2h3d', 'AcKhQs'), pct('7h7d', '8c9hTs')].forEach((value) => {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(1);
        });
    });
});

describe('bucketing', () => {
    it('uses the documented thresholds', () => {
        expect(STRENGTH_THRESHOLDS).toEqual({ nuts: 0.99, strong: 0.85, medium: 0.55 });
    });

    it.each([
        [1, 'nuts'],
        [0.99, 'nuts'],
        [0.985, 'strong'],
        [0.85, 'strong'],
        [0.7, 'medium'],
        [0.55, 'medium'],
        [0.54, 'weak'],
        [0, 'weak'],
    ] as const)('buckets %f as %s', (percentile, expected) => {
        expect(bucketPercentile(percentile)).toBe(expected);
    });

    it('only ever returns a bucket the ontology declares', () => {
        expect(RELATIVE_STRENGTHS).toContain(classifyRelativeStrength(cards('AhKd'), cards('Qc7h2s')));
    });

    it('classifies the nuts as nuts and air as weak', () => {
        expect(classifyRelativeStrength(cards('AhKh'), cards('QhJhTh'))).toBe('nuts');
        expect(classifyRelativeStrength(cards('3h2d'), cards('AcKhQs'))).toBe('weak');
    });
});

describe('the sampled regression', () => {
    /**
     * A seeded stratified sample across flop, turn and river, digested.
     *
     * Sampled rather than exhaustive because exhaustive is hours; seeded so the
     * same 5,000 pairs are checked on every run and a failure is reproducible
     * rather than a flake. A diff here means hand strength changed, which means
     * every drill that keys on `relative_strength` now asks something different.
     *
     * About 5.5 million evaluations: a few seconds alone, longer when the whole
     * suite shares the machine, so it carries its own timeout. Measured with the
     * whole repository's tests running at once: 16 s in WSL, 38 s on a 2-core
     * GitHub runner.
     */
    it('scores 5,000 seeded spots identically to the committed digest', { timeout: 120_000 }, () => {
        const rng = makeRng(20260821);
        const lines: string[] = [];
        const buckets: Record<RelativeStrength, number> = { nuts: 0, strong: 0, medium: 0, weak: 0 };

        for (let trial = 0; trial < 5_000; trial += 1) {
            const boardSize = 3 + (trial % 3);
            const drawn = rng.shuffle(DECK).slice(0, 2 + boardSize).map(cardOrThrow);
            const hole = drawn.slice(0, 2);
            const board = drawn.slice(2);

            const percentile = handPercentile(hole, board);
            buckets[bucketPercentile(percentile)] += 1;
            lines.push(`${drawn.map((c) => c.rank + c.suit).join('')}|${percentile.toFixed(6)}`);
        }

        const hash = createHash('sha256').update(lines.join('\n')).digest('hex');
        expect({ hash, buckets }).toMatchSnapshot();
    });
});

describe('refusing to guess', () => {
    it.each([1, 3])('throws on %i hole cards', (count) => {
        expect(() => handPercentile(cards('AhKdQc').slice(0, count), cards('7h4c2d')))
            .toThrow(BadHoleCardsError);
    });
});
