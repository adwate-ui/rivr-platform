import { describe, expect, it } from 'vitest';
import { nextReward } from './index.ts';

const HOODIE = { id: 'hoodie', points: 4000n };
const UPGRADE = { id: 'upgrade', points: 2500n };
const SEAT = { id: 'seat', points: 12_000n };
const SUITE = { id: 'suite', points: null };

describe('the next reward on Rewards (decision 0320)', () => {
  it('is the cheapest reward above the balance, with the gap and the share held', () => {
    expect(nextReward(3250n, [UPGRADE, SEAT, HOODIE, SUITE])).toEqual({ item: HOODIE, gap: 750n, fraction: 0.8125 });
  });

  it('skips rewards already within reach and those in hotel nights', () => {
    expect(nextReward(4000n, [UPGRADE, HOODIE, SEAT, SUITE])?.item).toEqual(SEAT);
  });

  it('is none when every reward is within reach, or none is in points', () => {
    expect(nextReward(20_000n, [UPGRADE, HOODIE, SEAT])).toBeNull();
    expect(nextReward(0n, [SUITE])).toBeNull();
    expect(nextReward(0n, [])).toBeNull();
  });

  it('starts empty at no points', () => {
    expect(nextReward(0n, [UPGRADE])).toEqual({ item: UPGRADE, gap: 2500n, fraction: 0 });
    expect(nextReward(-5n, [UPGRADE])?.fraction).toBe(0);
  });
});
