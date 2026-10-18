import { describe, it, expect } from 'vitest';
import { clopperPearson } from './interval.ts';

/**
 * Pinned to the exact intervals of a few small samples. The closed forms for k = 0
 * and k = n are a second, independent check on the same code path.
 */
const percent = (value: number): string => (value * 100).toFixed(1);

describe('the Clopper–Pearson interval', () => {
    it('reproduces the intervals pinned for small out-of-sample counts', () => {
        const probe = clopperPearson(6, 7);
        expect(percent(probe[0])).toBe('42.1');
        expect(percent(probe[1])).toBe('99.6');

        const rederived = clopperPearson(4, 5);
        expect(percent(rederived[0])).toBe('28.4');
        expect(percent(rederived[1])).toBe('99.5');

        const literal = clopperPearson(1, 1);
        expect(percent(literal[0])).toBe('2.5');
        expect(literal[1]).toBe(1);
    });

    it('matches the closed form when every trial succeeded', () => {
        // P(all n succeed | p) = p^n = α/2 at the lower bound.
        const [tenLo, tenHi] = clopperPearson(10, 10);
        expect(tenLo).toBeCloseTo(Math.pow(0.025, 1 / 10), 10);
        expect(tenHi).toBe(1);
        expect(percent(tenLo)).toBe('69.2');

        const [sevenLo] = clopperPearson(7, 7);
        expect(sevenLo).toBeCloseTo(Math.pow(0.025, 1 / 7), 10);
        expect(percent(sevenLo)).toBe('59.0');
    });

    it('matches the closed form when no trial succeeded', () => {
        // P(none succeed | p) = (1 − p)^n = α/2 at the upper bound.
        const [lo, hi] = clopperPearson(0, 5);
        expect(lo).toBe(0);
        expect(hi).toBeCloseTo(1 - Math.pow(0.025, 1 / 5), 10);
    });

    it('narrows as the sample grows and honours a different alpha', () => {
        const [narrowLo, narrowHi] = clopperPearson(60, 100);
        const [wideLo, wideHi] = clopperPearson(6, 10);
        expect(narrowHi - narrowLo).toBeLessThan(wideHi - wideLo);
        expect(narrowLo).toBeLessThan(0.6);
        expect(narrowHi).toBeGreaterThan(0.6);

        const [looseLo, looseHi] = clopperPearson(6, 10, 0.2);
        expect(looseLo).toBeGreaterThan(wideLo);
        expect(looseHi).toBeLessThan(wideHi);
    });

    it('refuses counts that are not a sample', () => {
        expect(() => clopperPearson(0, 0)).toThrow(RangeError);
        expect(() => clopperPearson(3, 2)).toThrow(RangeError);
        expect(() => clopperPearson(-1, 2)).toThrow(RangeError);
        expect(() => clopperPearson(1.5, 3)).toThrow(RangeError);
        expect(() => clopperPearson(1, 3, 0)).toThrow(RangeError);
        expect(() => clopperPearson(1, 3, 1)).toThrow(RangeError);
    });
});
