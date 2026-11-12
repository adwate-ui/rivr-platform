import type { TvLeaderboardRow } from '@rivr/db';
import { describe, expect, it } from 'vitest';
import { toLeaderboardColumns } from './LeaderboardMode.tsx';

const row = (place: number, name: string | null, minutes: number, memberNumber: number | null = null): TvLeaderboardRow => ({
  period: 'week', place, name, memberNumber, minutes,
});

describe('the hours leaderboard (decision 0581)', () => {
  it('heads each column with the period and its places, and gives each row its hours and minutes', () => {
    const rows = [row(1, 'Kabir S.', 300), row(2, 'Naina K.', 210), row(2, 'Rohan B.', 210)];
    const columns = toLeaderboardColumns(rows);
    expect(columns.map((column) => [column.stake, column.detail])).toEqual([['This week', 'Places 1 to 3']]);
    expect(columns[0]?.places.map((place) => [place.place, place.name, place.status])).toEqual([
      ['1', 'Kabir S.', '5h 00m'], ['2', 'Naina K.', '3h 30m'], ['2', 'Rohan B.', '3h 30m'],
    ]);
  });

  it('shows a member who hid their name by their member number', () => {
    const columns = toLeaderboardColumns([row(1, null, 61, 17)]);
    expect(columns[0]?.places[0]?.name).toBe('Member #17');
  });

  it('puts six to a column, the rest in a second', () => {
    const rows = Array.from({ length: 9 }, (_, index) => row(index + 1, `Player ${String(index + 1)}`, 600 - index * 10));
    const columns = toLeaderboardColumns(rows);
    expect(columns.map((column) => [column.detail, column.places.length])).toEqual([['Places 1 to 6', 6], ['Places 7 to 9', 3]]);
  });

  it('with nobody yet, has no column, so the board says so or passes on in a rotation', () => {
    expect(toLeaderboardColumns([])).toEqual([]);
  });
});
