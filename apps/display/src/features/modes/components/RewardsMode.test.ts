import { describe, expect, it } from 'vitest';
import { toRewardsColumns } from './RewardsMode.tsx';

describe('the rewards ticker (decision 0183)', () => {
  it('shows the leaders by place and the redemptions by time, a hidden name as a member', () => {
    const [leaders, redeemed] = toRewardsColumns({
      leaders: [{ place: 1, name: 'Mihir S.', points: 30_000n }, { place: 2, name: null, points: 20_000n }],
      redemptions: [{ name: 'Mihir S.', rewardName: 'Bar upgrade, one night', at: '2026-11-15T17:10:00Z' }],
    });
    expect(leaders?.places).toEqual([
      { id: 'leader-0', place: '1', name: 'Mihir S.', status: '30,000 points' },
      { id: 'leader-1', place: '2', name: 'A member', status: '20,000 points' },
    ]);
    expect(redeemed?.places).toEqual([{ id: 'redemption-0', place: '', name: 'Mihir S.', status: 'Bar upgrade, one night' }]);
  });
});
