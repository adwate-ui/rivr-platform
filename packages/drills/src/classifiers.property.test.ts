import { describe, it, expect } from 'vitest';
import { DECK_CARDS, type Card } from './cards/cards.ts';
import { boardTags } from './boardTexture.ts';
import { classifyMadeHand } from './handClass.ts';
import { classifyRelativeStrength, handPercentile } from './relativeStrength.ts';
import { classifyRunout } from './runout.ts';
import { makeRng } from './prng.ts';
import { allFlops, canonicalFlops, applySuitPermutation, SUIT_PERMUTATIONS, show } from './boardEnumeration.ts';

/**
 * Properties every classifier must hold, whatever the input.
 *
 * These catch a different class of bug from the fixtures. A fixture says "this
 * board is two-tone"; a property says "no board's classification depends on the
 * order somebody happened to deal it", which is a claim about all 22,100 of
 * them and about every board nobody has written a fixture for yet.
 *
 * Suit-isomorphism invariance is the strongest of the four. Almost every real
 * classifier bug — a hardcoded suit, an index off by one, a comparison that
 * happens to work because hearts sort first — shows up as a board that changes
 * its tags when you repaint the suits.
 */

/** The card at `index` of a deal; dealing too few is a bug in the test. */
function nth(drawn: readonly Card[], index: number): Card {
    const card = drawn[index];
    if (card === undefined) throw new Error(`No card at ${index}`);
    return card;
}

/** All k! orderings of a small array. */
function permutations<T>(items: readonly T[]): T[][] {
    if (items.length <= 1) return [[...items]];
    const out: T[][] = [];
    items.forEach((item, index) => {
        const rest = [...items.slice(0, index), ...items.slice(index + 1)];
        permutations(rest).forEach((tail) => out.push([item, ...tail]));
    });
    return out;
}

describe('card order does not matter', () => {
    it('tags every flop the same under all six orderings', () => {
        for (const { flop } of canonicalFlops()) {
            const expected = boardTags(flop).join(',');
            for (const ordering of permutations(flop)) {
                expect(boardTags(ordering).join(','), show(ordering)).toBe(expected);
            }
        }
    });

    it('tags a five-card board the same under sampled reorderings', () => {
        const rng = makeRng(515);
        for (let trial = 0; trial < 300; trial += 1) {
            const board = rng.shuffle(DECK_CARDS).slice(0, 5);
            const expected = boardTags(board).join(',');
            for (let shuffleCount = 0; shuffleCount < 6; shuffleCount += 1) {
                expect(boardTags(rng.shuffle(board)).join(',')).toBe(expected);
            }
        }
    });

    it('classifies a hand the same whichever hole card comes first', () => {
        const rng = makeRng(616);
        for (let trial = 0; trial < 500; trial += 1) {
            const drawn = rng.shuffle(DECK_CARDS).slice(0, 7);
            const hole = drawn.slice(0, 2);
            const board = drawn.slice(2, 5 + (trial % 3));

            const forward = classifyMadeHand(hole, board);
            const reversed = classifyMadeHand([...hole].reverse(), board);
            expect(reversed.handClass).toBe(forward.handClass);
            expect(reversed.draws).toEqual(forward.draws);
        }
    });
});

describe('repainting the suits changes nothing', () => {
    it('tags every flop identically under all 24 suit relabellings', () => {
        for (const { flop } of canonicalFlops()) {
            const expected = boardTags(flop).join(',');
            for (const perm of SUIT_PERMUTATIONS) {
                const repainted = applySuitPermutation(flop, perm);
                expect(boardTags(repainted).join(','), show(repainted)).toBe(expected);
            }
        }
    });

    it('classifies hands and draws identically under a repaint', () => {
        const rng = makeRng(717);
        for (let trial = 0; trial < 400; trial += 1) {
            const drawn = rng.shuffle(DECK_CARDS).slice(0, 7);
            const hole = drawn.slice(0, 2);
            const board = drawn.slice(2, 5 + (trial % 3));
            const expected = classifyMadeHand(hole, board);

            for (const perm of rng.shuffle([...SUIT_PERMUTATIONS]).slice(0, 4)) {
                const actual = classifyMadeHand(
                    applySuitPermutation(hole, perm),
                    applySuitPermutation(board, perm),
                );
                expect(actual.handClass, show([...hole, ...board])).toBe(expected.handClass);
                expect(actual.draws).toEqual(expected.draws);
            }
        }
    });

    it('scores relative strength identically under a repaint', () => {
        const rng = makeRng(818);
        for (let trial = 0; trial < 60; trial += 1) {
            const drawn = rng.shuffle(DECK_CARDS).slice(0, 7);
            const hole = drawn.slice(0, 2);
            const board = drawn.slice(2, 5 + (trial % 3));
            const expected = handPercentile(hole, board);

            const perm = rng.pick(SUIT_PERMUTATIONS);
            const actual = handPercentile(
                applySuitPermutation(hole, perm),
                applySuitPermutation(board, perm),
            );
            expect(actual, show([...hole, ...board])).toBeCloseTo(expected, 12);
        }
    });

    it('classifies a runout identically under a repaint', () => {
        const rng = makeRng(919);
        for (let trial = 0; trial < 400; trial += 1) {
            const drawn = rng.shuffle(DECK_CARDS).slice(0, 7);
            const before = drawn.slice(0, 3 + (trial % 2));
            const card = nth(drawn, 5);
            const hole = drawn.slice(6, 7).concat(drawn.slice(0, 1));
            const expected = classifyRunout(before, card, hole).join(',');

            const perm = rng.pick(SUIT_PERMUTATIONS);
            expect(classifyRunout(
                applySuitPermutation(before, perm),
                nth(applySuitPermutation([card], perm), 0),
                applySuitPermutation(hole, perm),
            ).join(',')).toBe(expected);
        }
    });
});

describe('classification is a function, not a process', () => {
    it('returns the same answer for the same input, every time', () => {
        const rng = makeRng(1010);
        for (let trial = 0; trial < 200; trial += 1) {
            const drawn = rng.shuffle(DECK_CARDS).slice(0, 7);
            const hole = drawn.slice(0, 2);
            const board = drawn.slice(2, 7);

            expect(boardTags(board)).toEqual(boardTags(board));
            expect(classifyMadeHand(hole, board)).toEqual(classifyMadeHand(hole, board));
            expect(classifyRelativeStrength(hole, board)).toBe(classifyRelativeStrength(hole, board));
        }
    });
});

describe('the flop enumeration itself', () => {
    it('produces every three-card combination exactly once', () => {
        const flops = allFlops();
        expect(flops).toHaveLength(22100);

        const keys = new Set(
            flops.map((flop) => flop.map((c) => `${c.rank}${c.suit}`).sort().join('')),
        );
        expect(keys.size).toBe(22100);
    });
});
