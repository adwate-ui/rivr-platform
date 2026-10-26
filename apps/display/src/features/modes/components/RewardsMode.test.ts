import type { LeagueBoardRow } from '@rivr/db';
import { describe, expect, it } from 'vitest';
import { toLeagueColumns } from './LeagueMode.tsx';
import { toRewardsColumns } from './RewardsMode.tsx';

const row = (standing: 'month' | 'season', place: number, name: string | null, points: bigint): LeagueBoardRow => ({
  standing, seasonName: standing === 'season' ? 'Season one' : null, firstMonth: '2026-11-01', lastMonth: standing === 'season' ? '2027-04-01' : '2026-11-01',
  place, name, points, isMe: false,
});

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
    expect(redeemed?.places).toEqual([{ id: 'redemption-0', place: '22:40', name: 'Mihir S.', status: 'Bar upgrade, one night' }]);
  });
});

describe('the League leaderboard (decision 0182)', () => {
  it('shows this month, then the season with its months', () => {
    const columns = toLeagueColumns([row('month', 1, 'Mihir S.', 135n), row('month', 2, null, 25n), row('season', 1, 'Mihir S.', 900n)]);
    expect(columns.map((column) => [column.stake, column.detail])).toEqual([
      ['This month', 'November 2026'], ['Season one', 'November 2026 to April 2027'],
    ]);
    expect(columns[0]?.places.map((place) => [place.place, place.name, place.status])).toEqual([
      ['1', 'Mihir S.', '135 points'], ['2', 'A member', '25 points'],
    ]);
  });

  it('without a season or anyone with points, shows this month alone', () => {
    expect(toLeagueColumns([])).toEqual([{ id: 'month', stake: 'This month', detail: '', places: [] }]);
  });
});
