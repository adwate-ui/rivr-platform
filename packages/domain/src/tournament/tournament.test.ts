import { describe, expect, it } from 'vitest';
import { fromRupees } from '../money/index.ts';
import { clockAt, elapsedNow, levelAtOrAfter, nextLevelAfter, stageStartSeconds } from './clock.ts';
import { poolShare } from './pool.ts';
import { levelCount, MOST_STAGES, structureMinutes, structureProblem, type Stage } from './stages.ts';

const level = (bigBlind: number, minutes = 20): Stage => ({ kind: 'level', smallBlind: bigBlind / 2, bigBlind, ante: bigBlind, minutes });
const pause = (minutes: number): Stage => ({ kind: 'break', minutes });
const SUNDAY_START: readonly Stage[] = [level(200), level(400), pause(10), level(800)];

describe('structureProblem', () => {
  it('passes a structure the clock can run', () => {
    expect(structureProblem(SUNDAY_START)).toBeNull();
  });

  it('names what is wrong', () => {
    expect(structureProblem([])).toBe('empty');
    expect(structureProblem(Array.from({ length: MOST_STAGES + 1 }, () => level(200)))).toBe('too_long');
    expect(structureProblem(Array.from({ length: MOST_STAGES }, () => level(200)))).toBeNull();
    expect(structureProblem([pause(10), level(200)])).toBe('break_first');
    expect(structureProblem([level(200), pause(10), pause(5), level(400)])).toBe('breaks_together');
    expect(structureProblem([level(200), pause(10)])).toBeNull();
    expect(structureProblem([level(200, 0)])).toBe('minutes');
    expect(structureProblem([level(200, 121)])).toBe('minutes');
    expect(structureProblem([level(200, 120), level(400, 1)])).toBeNull();
    expect(structureProblem([level(200, 2.5)])).toBe('minutes');
  });

  it('refuses blinds that make no sense', () => {
    const blinds = (smallBlind: number, bigBlind: number, ante: number): Stage[] => [{ kind: 'level', smallBlind, bigBlind, ante, minutes: 20 }];
    expect(structureProblem(blinds(300, 200, 0))).toBe('blinds');
    expect(structureProblem(blinds(0, 200, 0))).toBe('blinds');
    expect(structureProblem(blinds(1, 0, 0))).toBe('blinds');
    expect(structureProblem(blinds(100, 200, -1))).toBe('blinds');
    expect(structureProblem(blinds(100.5, 200, 0))).toBe('blinds');
    expect(structureProblem(blinds(200, 200, 0))).toBeNull();
    expect(structureProblem(blinds(1, 1, 0))).toBeNull();
  });

  it('measures a structure', () => {
    expect(structureMinutes(SUNDAY_START)).toBe(70);
    expect(levelCount(SUNDAY_START)).toBe(3);
  });
});

describe('the clock between stages', () => {
  it('starts each stage after those before it', () => {
    expect(stageStartSeconds(SUNDAY_START, 0)).toBe(0);
    expect(stageStartSeconds(SUNDAY_START, 3)).toBe(3000);
    expect(stageStartSeconds(SUNDAY_START, -1)).toBe(0);
  });

  it('shows the first level in full before the start', () => {
    expect(clockAt(SUNDAY_START, -90)).toEqual({ stage: 0, level: 1, isBreak: false, secondsLeft: 1200 });
    expect(clockAt(SUNDAY_START, 0.9)).toEqual({ stage: 0, level: 1, isBreak: false, secondsLeft: 1200 });
  });

  it('refuses a structure with nothing in it, as a bug', () => {
    expect(() => clockAt([], 0)).toThrow(RangeError);
  });

  it('knows the next level, over a break, and none after the last', () => {
    expect(nextLevelAfter(SUNDAY_START, 1)).toEqual(level(800));
    expect(nextLevelAfter(SUNDAY_START, 3)).toBeUndefined();
    expect(levelAtOrAfter(SUNDAY_START, 2)).toEqual(level(800));
    expect(levelAtOrAfter(SUNDAY_START, 0)).toEqual(level(200));
  });
});

describe('poolShare', () => {
  it('puts the price less the fee in the pool', () => {
    expect(poolShare(fromRupees(10_000n), fromRupees(1_000n))).toBe(fromRupees(9_000n));
    expect(poolShare(fromRupees(2_000n), fromRupees(0n))).toBe(fromRupees(2_000n));
    expect(poolShare(fromRupees(1_000n), fromRupees(950n))).toBe(fromRupees(50n));
  });

  it('refuses a fee at or above the price, or below nothing, as a bug', () => {
    expect(() => poolShare(fromRupees(1_000n), fromRupees(1_050n))).toThrow(RangeError);
    expect(() => poolShare(fromRupees(1_000n), fromRupees(1_000n))).toThrow(RangeError);
    expect(() => poolShare(fromRupees(1_000n), fromRupees(-50n))).toThrow(RangeError);
  });
});

describe('elapsedNow', () => {
  const reading = { elapsedSeconds: 600, isRunning: true, readAtMs: 1_000_000 };

  it('runs on from the server’s reading in whole seconds', () => {
    expect(elapsedNow(reading, 1_000_000)).toBe(600);
    expect(elapsedNow(reading, 1_002_999)).toBe(602);
    expect(elapsedNow(reading, 1_003_000)).toBe(603);
  });

  it('never runs back when this device’s clock does', () => {
    expect(elapsedNow(reading, 990_000)).toBe(600);
  });

  it('stands still while paused', () => {
    expect(elapsedNow({ ...reading, isRunning: false }, 9_000_000)).toBe(600);
  });
});
