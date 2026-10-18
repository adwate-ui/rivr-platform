import { describe, it, expect } from 'vitest';
import {
    FSRS5_DEFAULT_WEIGHTS, DEFAULT_CONFIG, initialState, initialStability, initialDifficulty,
    nextState, retrievability, intervalDays, type Grade, type MemoryState,
} from './fsrs.ts';

/**
 * The FSRS-5 arithmetic.
 *
 * The assertions are about SHAPE rather than exact numbers — a right answer
 * lengthens the interval, a lapse shortens it, difficulty reverts — because
 * pinning the arithmetic to six decimal places would make a weight retune look
 * like a regression when it is a decision.
 */

const GRADES: readonly Grade[] = [1, 2, 3, 4];

describe('FSRS-5', () => {
    it('carries all nineteen published weights', () => {
        expect(FSRS5_DEFAULT_WEIGHTS).toHaveLength(19);
        FSRS5_DEFAULT_WEIGHTS.forEach((weight) => expect(Number.isFinite(weight)).toBe(true));
    });

    it('starts an easier rating at a higher stability', () => {
        const stabilities = GRADES.map((grade) => initialStability(grade, DEFAULT_CONFIG));
        stabilities.slice(1).forEach((stability, i) => {
            expect(stability).toBeGreaterThan(stabilities[i] ?? Number.POSITIVE_INFINITY);
        });
    });

    it('starts an easier rating at a lower difficulty', () => {
        expect(initialDifficulty(4, DEFAULT_CONFIG)).toBeLessThan(initialDifficulty(1, DEFAULT_CONFIG));
    });

    it('keeps difficulty inside 1 to 10 whatever it is handed', () => {
        GRADES.forEach((grade) => {
            const difficulty = initialDifficulty(grade, DEFAULT_CONFIG);
            expect(difficulty).toBeGreaterThanOrEqual(1);
            expect(difficulty).toBeLessThanOrEqual(10);
        });
    });

    it('decays retrievability from 1 as time passes', () => {
        expect(retrievability(0, 10)).toBeCloseTo(1, 10);
        expect(retrievability(10, 10)).toBeLessThan(1);
        expect(retrievability(100, 10)).toBeLessThan(retrievability(10, 10));
        expect(retrievability(1000, 10)).toBeGreaterThan(0);
    });

    it('treats a negative elapsed time as no time at all', () => {
        expect(retrievability(-5, 10)).toBe(1);
    });

    it('reaches the requested retention at the scheduled interval', () => {
        const stability = 30;
        const interval = intervalDays(stability);
        expect(retrievability(interval, stability)).toBeCloseTo(DEFAULT_CONFIG.requestRetention, 2);
    });

    it('never schedules inside a day or beyond the maximum', () => {
        expect(intervalDays(0.01)).toBe(1);
        expect(intervalDays(1e9)).toBe(DEFAULT_CONFIG.maximumIntervalDays);
    });

    it('grows stability on a recall and shrinks it on a lapse', () => {
        const before: MemoryState = { stability: 10, difficulty: 5 };
        expect(nextState(before, 10, 3).stability).toBeGreaterThan(before.stability);
        expect(nextState(before, 10, 1).stability).toBeLessThanOrEqual(before.stability);
    });

    it('rewards an easy answer more than a hard one', () => {
        const before: MemoryState = { stability: 10, difficulty: 5 };
        const hard = nextState(before, 10, 2).stability;
        const good = nextState(before, 10, 3).stability;
        const easy = nextState(before, 10, 4).stability;
        expect(easy).toBeGreaterThan(good);
        expect(good).toBeGreaterThan(hard);
    });

    it('makes a card harder on a lapse and easier on an easy answer', () => {
        const before: MemoryState = { stability: 10, difficulty: 5 };
        expect(nextState(before, 10, 1).difficulty).toBeGreaterThan(before.difficulty);
        expect(nextState(before, 10, 4).difficulty).toBeLessThan(before.difficulty);
    });

    it('reverts difficulty toward the anchor rather than ratcheting forever', () => {
        let state: MemoryState = { stability: 10, difficulty: 10 };
        for (let i = 0; i < 30; i += 1) state = nextState(state, 10, 3);
        expect(state.difficulty).toBeLessThan(10);
        expect(state.difficulty).toBeGreaterThanOrEqual(1);
    });

    it('never lets stability reach zero, however many lapses', () => {
        let state: MemoryState = { stability: 10, difficulty: 5 };
        for (let i = 0; i < 50; i += 1) state = nextState(state, 30, 1);
        expect(state.stability).toBeGreaterThan(0);
    });

    it('treats a first review as a first review, ignoring elapsed time', () => {
        expect(nextState(null, 999, 3)).toEqual(initialState(3));
    });

    it('grows stability more the longer a card was left before recall', () => {
        const before: MemoryState = { stability: 10, difficulty: 5 };
        expect(nextState(before, 30, 3).stability).toBeGreaterThan(nextState(before, 1, 3).stability);
    });

    it('refuses a configuration that is missing a weight', () => {
        const short = { ...DEFAULT_CONFIG, weights: FSRS5_DEFAULT_WEIGHTS.slice(0, 4) };
        expect(() => initialDifficulty(3, short)).toThrow(RangeError);
    });
});
