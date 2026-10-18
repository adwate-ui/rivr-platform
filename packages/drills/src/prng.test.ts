import { describe, it, expect } from 'vitest';
import {
    makeRng,
    deriveSeed,
    splitmix32,
    cyrb128,
    EmptyPickError,
    RangeTooSmallError,
} from './prng.ts';

/**
 * The seeded stream everything downstream is reproducible through.
 *
 * Two properties matter and they are easy to confuse. DETERMINISM — the same
 * seed gives the same sequence — is what replay depends on, and is trivially
 * true of a biased generator too. UNIFORMITY is the one that can rot silently:
 * a `floor(next() * n)` implementation is perfectly deterministic while serving
 * some outcomes more often than others, and no fixed-seed assertion can tell.
 * So both are tested, and the uniformity test is the one with teeth.
 */

describe('determinism', () => {
    it('replays an identical sequence from an identical seed', () => {
        const a = makeRng(12345);
        const b = makeRng(12345);
        const drawA = Array.from({ length: 50 }, () => a.next());
        const drawB = Array.from({ length: 50 }, () => b.next());
        expect(drawA).toEqual(drawB);
    });

    it('gives adjacent seeds unrelated streams, so seed+1 is not a near-repeat', () => {
        const a = Array.from({ length: 20 }, (_, i) => makeRng(1).nextInt(100) + i * 0);
        const b = Array.from({ length: 20 }, (_, i) => makeRng(2).nextInt(100) + i * 0);
        expect(a[0]).not.toBe(b[0]);

        const streamA = Array.from({ length: 20 }, () => makeRng(1).next());
        expect(new Set(streamA).size).toBe(1); // a fresh rng each time repeats itself
    });

    it('advances, rather than returning the same number forever', () => {
        const rng = makeRng(7);
        const draws = Array.from({ length: 100 }, () => rng.next());
        expect(new Set(draws).size).toBeGreaterThan(90);
    });
});

describe('next', () => {
    it('stays inside [0, 1) across a long run', () => {
        const rng = makeRng(99);
        for (let i = 0; i < 10_000; i += 1) {
            const value = rng.next();
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
        }
    });
});

describe('nextInt', () => {
    it('stays inside [0, max) and reaches both ends', () => {
        const rng = makeRng(4);
        const seen = new Set<number>();
        for (let i = 0; i < 5_000; i += 1) {
            const value = rng.nextInt(6);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(6);
            seen.add(value);
        }
        expect(seen.size).toBe(6);
    });

    it('always returns 0 for a bound of 1', () => {
        const rng = makeRng(4);
        expect(Array.from({ length: 20 }, () => rng.nextInt(1))).toEqual(Array(20).fill(0));
    });

    /**
     * The bias test. A bound that does not divide 2^32 is where
     * `floor(next() * n)` skews, so 3 and 7 are the interesting bounds; a
     * power of two would pass either way and prove nothing.
     */
    it.each([3, 5, 6, 7, 10])('spreads evenly over a bound of %i that does not divide 2^32', (bound) => {
        const rng = makeRng(2024);
        const counts = new Array<number>(bound).fill(0);
        const draws = 60_000;
        for (let i = 0; i < draws; i += 1) {
            const drawn = rng.nextInt(bound);
            counts[drawn] = (counts[drawn] ?? 0) + 1;
        }

        const expected = draws / bound;
        counts.forEach((count) => {
            // Well inside sampling noise at this n, but far tighter than the
            // ~1-in-bound skew a biased implementation produces.
            expect(Math.abs(count - expected) / expected).toBeLessThan(0.05);
        });
    });

    /**
     * Exercises the rejection loop itself.
     *
     * For an ordinary bound like 6 the discarded tail is ~6 values in 2^32, so
     * the loop body would never run in any feasible test and would sit there
     * unexecuted — the one line whose absence silently reintroduces the bias.
     * A bound just over half the range inverts that: 2^31+1 leaves a tail of
     * 2^31-1, so very nearly HALF of all draws are rejected and the loop is hit
     * within the first few calls.
     */
    it('discards and redraws when a value lands in the biased tail', () => {
        const rng = makeRng(1);
        const bound = 2 ** 31 + 1;
        for (let i = 0; i < 64; i += 1) {
            const value = rng.nextInt(bound);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(bound);
        }
    });

    it.each([0, -1, 1.5, NaN])('refuses a bound of %s rather than returning nonsense', (bound) => {
        const rng = makeRng(1);
        expect(() => rng.nextInt(bound)).toThrow(RangeTooSmallError);
    });
});

describe('pick', () => {
    it('only ever returns a member, and reaches every one of them', () => {
        const rng = makeRng(11);
        const items = ['a', 'b', 'c', 'd'] as const;
        const seen = new Set<string>();
        for (let i = 0; i < 2_000; i += 1) {
            const chosen = rng.pick(items);
            expect(items).toContain(chosen);
            seen.add(chosen);
        }
        expect(seen.size).toBe(items.length);
    });

    it('throws on an empty array rather than returning undefined', () => {
        expect(() => makeRng(1).pick([])).toThrow(EmptyPickError);
    });
});

describe('shuffle', () => {
    it('is a permutation: same members, same length', () => {
        const rng = makeRng(3);
        const input = Array.from({ length: 20 }, (_, i) => i);
        const out = rng.shuffle(input);
        expect(out).toHaveLength(input.length);
        expect([...out].sort((a, b) => a - b)).toEqual(input);
    });

    it('does not mutate its input', () => {
        const rng = makeRng(3);
        const input = [1, 2, 3, 4, 5];
        const copy = [...input];
        rng.shuffle(input);
        expect(input).toEqual(copy);
    });

    it('actually reorders, and reorders the same way for the same seed', () => {
        const input = Array.from({ length: 30 }, (_, i) => i);
        expect(makeRng(8).shuffle(input)).not.toEqual(input);
        expect(makeRng(8).shuffle(input)).toEqual(makeRng(8).shuffle(input));
    });

    it('handles the degenerate lengths the loop bound has to get right', () => {
        const rng = makeRng(5);
        expect(rng.shuffle([])).toEqual([]);
        expect(rng.shuffle([42])).toEqual([42]);
    });
});

describe('seed derivation', () => {
    it('returns an unsigned 32-bit integer', () => {
        [splitmix32(0), splitmix32(123456789), cyrb128(''), cyrb128('abc'), deriveSeed('a', 1)]
            .forEach((value) => {
                expect(Number.isInteger(value)).toBe(true);
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThan(4294967296);
            });
    });

    it('is stable for the same parts', () => {
        expect(deriveSeed('pr_btn_rfi', 3)).toBe(deriveSeed('pr_btn_rfi', 3));
    });

    it('separates principles, attempts, and their order', () => {
        expect(deriveSeed('pr_a', 1)).not.toBe(deriveSeed('pr_b', 1));
        expect(deriveSeed('pr_a', 1)).not.toBe(deriveSeed('pr_a', 2));
        expect(deriveSeed('a', 'b')).not.toBe(deriveSeed('b', 'a'));
    });

    it('accepts no parts at all, and mixes strings with numbers', () => {
        expect(Number.isInteger(deriveSeed())).toBe(true);
        expect(Number.isInteger(deriveSeed('a', 1, 'b', 2))).toBe(true);
    });

    it('distinguishes strings that differ only late, so long ids do not collide', () => {
        expect(cyrb128('pr_flop_cbet_dry_vs_station_a'))
            .not.toBe(cyrb128('pr_flop_cbet_dry_vs_station_b'));
    });

    it('feeds distinct streams from distinct derived seeds', () => {
        const a = makeRng(deriveSeed('pr_a', 1));
        const b = makeRng(deriveSeed('pr_b', 1));
        expect(a.next()).not.toBe(b.next());
    });
});
