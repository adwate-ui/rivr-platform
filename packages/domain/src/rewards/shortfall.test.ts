import { describe, expect, it } from 'vitest';
import { rewardShortfall } from './index.ts';

const HELD = { points: 3250n, nights: 1250n };

describe('how far short of a reward a member is (F-046)', () => {
  it('counts points for a reward in points', () => {
    expect(rewardShortfall({ points: 4000n, nights: null }, HELD)).toEqual({ unit: 'points', short: 750n });
  });

  it('is nothing with the points exactly held, or more', () => {
    expect(rewardShortfall({ points: 3250n, nights: null }, HELD)).toBeNull();
    expect(rewardShortfall({ points: 500n, nights: null }, HELD)).toBeNull();
  });

  it('counts thousandths of a night for a hotel reward', () => {
    expect(rewardShortfall({ points: null, nights: 2 }, HELD)).toEqual({ unit: 'nights', short: 750n });
    expect(rewardShortfall({ points: null, nights: 1 }, { points: 0n, nights: 0n })).toEqual({ unit: 'nights', short: 1000n });
  });

  it('is nothing with the nights exactly held, or more', () => {
    expect(rewardShortfall({ points: null, nights: 1 }, { points: 0n, nights: 1000n })).toBeNull();
    expect(rewardShortfall({ points: null, nights: 1 }, HELD)).toBeNull();
  });
});
