import { describe, expect, it } from 'vitest';
import { fromPaise, fromRupees } from '../money/index.ts';
import { areBlinds, BLIND_CEILING, isBlind, isStakeCallTime, isStraddle, stakeTableRefusal } from './index.ts';

describe('a stake given to a table (redesign RD-16)', () => {
  it('is refused, by name, until the stake has a call time above zero', () => {
    expect(stakeTableRefusal(0)).toBe('stake_without_call_time');
    expect(stakeTableRefusal(-30)).toBe('stake_without_call_time');
  });

  it('may be given once it has one, however short', () => {
    expect(stakeTableRefusal(1)).toBeNull();
    expect(stakeTableRefusal(180)).toBeNull();
  });
});

describe('a stake\'s call time', () => {
  it('is whole minutes, above zero and a day at most', () => {
    expect([1, 180, 1440].map(isStakeCallTime)).toEqual([true, true, true]);
    expect([0, -1, 1441, 90.5, Number.NaN].map(isStakeCallTime)).toEqual([false, false, false, false, false]);
  });
});

describe('a blind (redesign RD-17)', () => {
  it('is a whole 50 above zero', () => {
    expect([50n, 100n, 2500n].map((rupees) => isBlind(fromRupees(rupees)))).toEqual([true, true, true]);
    expect([0n, -50n, 25n, 75n, 120n].map((rupees) => isBlind(fromRupees(rupees)))).toEqual([false, false, false, false, false]);
    expect(isBlind(fromPaise(5001n))).toBe(false);
  });

  it('is 1,00,00,000 at most, as the database takes it', () => {
    expect(BLIND_CEILING).toBe(1_000_000_000n);
    expect(isBlind(BLIND_CEILING)).toBe(true);
    expect(isBlind(fromPaise(BLIND_CEILING + 5000n))).toBe(false);
  });
});

describe('the blinds of a stake', () => {
  it('stand when each is a blind and the big blind is above the small', () => {
    expect(areBlinds(fromRupees(100n), fromRupees(200n))).toBe(true);
    expect(areBlinds(fromRupees(50n), fromRupees(100n))).toBe(true);
  });

  it('do not stand when the big blind is the small blind or less', () => {
    expect(areBlinds(fromRupees(200n), fromRupees(200n))).toBe(false);
    expect(areBlinds(fromRupees(200n), fromRupees(100n))).toBe(false);
  });

  it('do not stand when either is no blind', () => {
    expect(areBlinds(fromRupees(0n), fromRupees(100n))).toBe(false);
    expect(areBlinds(fromRupees(75n), fromRupees(200n))).toBe(false);
    expect(areBlinds(fromRupees(100n), fromRupees(225n))).toBe(false);
    expect(areBlinds(BLIND_CEILING, fromPaise(BLIND_CEILING + 5000n))).toBe(false);
  });
});

describe('the straddle of a stake (decision 0299)', () => {
  it('may be none', () => {
    expect(isStraddle(null, fromRupees(200n))).toBe(true);
  });

  it('is a blind above the big blind', () => {
    expect(isStraddle(fromRupees(400n), fromRupees(200n))).toBe(true);
    expect(isStraddle(fromRupees(250n), fromRupees(200n))).toBe(true);
    expect(isStraddle(fromRupees(200n), fromRupees(200n))).toBe(false);
    expect(isStraddle(fromRupees(100n), fromRupees(200n))).toBe(false);
  });

  it('is refused when it is no blind', () => {
    expect(isStraddle(fromRupees(425n), fromRupees(200n))).toBe(false);
    expect(isStraddle(fromPaise(BLIND_CEILING + 5000n), fromRupees(200n))).toBe(false);
  });
});
