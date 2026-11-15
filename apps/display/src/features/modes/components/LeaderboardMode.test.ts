import type { TvLeaderboardPeriod } from '@rivr/contracts';
import type { TvLeaderboardRow } from '@rivr/db';
import { describe, expect, it } from 'vitest';
import { toLeaderboardLists } from './LeaderboardMode.tsx';

/** A place on a list; a member with no name hid it on the TVs, and shows by member number 17. */
const row = (period: TvLeaderboardPeriod, place: number, name: string | null, minutes: number): TvLeaderboardRow => ({
  period, place, name, memberNumber: name === null ? 17 : null, minutes,
});

describe('the hours leaderboard (decision 0581; redesign RD-28)', () => {
  it('lists tonight, then the longer period, each row with its place and its time in the one form for a length of time', () => {
    const lists = toLeaderboardLists([
      row('tonight', 1, 'Kabir S.', 339), row('tonight', 2, 'Naina K.', 60),
      row('week', 1, 'Naina K.', 1442), row('week', 2, 'Kabir S.', 1200), row('week', 2, 'Rohan B.', 1200),
    ]);
    expect(lists.map((list) => [list.caption, list.rows.map((place) => [place.place, place.name, place.time])])).toEqual([
      ['Tonight', [['1', 'Kabir S.', '5 h 39 min'], ['2', 'Naina K.', '1 h']]],
      ['This week', [['1', 'Naina K.', '24 h 2 min'], ['2', 'Kabir S.', '20 h'], ['2', 'Rohan B.', '20 h']]],
    ]);
  });

  it('shows a member who hid their name by their member number', () => {
    expect(toLeaderboardLists([row('tonight', 1, null, 61)])[0]?.rows[0]?.name).toBe('Member #17');
  });

  it('keeps tonight\'s list, empty, while only the longer period has anyone, so the board says nobody has played yet tonight', () => {
    const lists = toLeaderboardLists([row('month', 1, 'Kabir S.', 300)]);
    expect(lists.map((list) => [list.caption, list.rows.length])).toEqual([['Tonight', 0], ['This month', 1]]);
  });

  it('with nobody at all, has no list, so the board says so or passes on in a rotation', () => {
    expect(toLeaderboardLists([])).toEqual([]);
  });
});
