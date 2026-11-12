import type { TvLeaderboardRow } from '@rivr/db';
import { describe, expect, it } from 'vitest';
import { toLeaderboardColumns } from './LeaderboardMode.tsx';

const row = (place: number, name: string | null, minutes: number, memberNumber: number | null = null): TvLeaderboardRow => ({
  period: 'week', place, name, memberNumber, minutes,
});
const ranked = (count: number, nameAt: (place: number) => string = (place) => `Player ${String(place)}`) =>
  Array.from({ length: count }, (_, index) => row(index + 1, nameAt(index + 1), 600 - index * 10));

describe('the hours leaderboard (decision 0581)', () => {
  it('heads each column with the period and the places it shows, as ranked, and gives each row its hours and minutes', () => {
    const columns = toLeaderboardColumns([row(1, 'Kabir S.', 300), row(2, 'Naina K.', 210), row(2, 'Rohan B.', 210)]);
    expect(columns.map((column) => [column.stake, column.detail])).toEqual([['This week', 'Places 1 to 2']]);
    expect(columns[0]?.places.map((place) => [place.place, place.name, place.status])).toEqual([
      ['1', 'Kabir S.', '5h 00m'], ['2', 'Naina K.', '3h 30m'], ['2', 'Rohan B.', '3h 30m'],
    ]);
  });

  it('shows a member who hid their name by their member number, and one place tied by all as that place', () => {
    const columns = toLeaderboardColumns([row(1, null, 61, 17), row(1, 'Kabir S.', 61)]);
    expect(columns[0]?.places[0]?.name).toBe('Member #17');
    expect(columns[0]?.detail).toBe('Place 1');
  });

  it('puts six short names in column one, and the rest in column two', () => {
    const columns = toLeaderboardColumns(ranked(9));
    expect(columns.map((column) => [column.detail, column.places.length])).toEqual([['Places 1 to 6', 6], ['Places 7 to 9', 3]]);
  });

  // The review of #907: a long name takes two lines, so column one holds five, and place 6 opens column two rather than hide.
  it('moves a place column one cannot hold to column two, so none is hidden between them', () => {
    const columns = toLeaderboardColumns(ranked(12, (place) => (place === 3 ? 'Siddharth M.' : `Player ${String(place)}`)));
    expect(columns.map((column) => [column.detail, column.places[0]?.place, column.places.length])).toEqual([
      ['Places 1 to 5', '1', 5], ['Places 6 to 11', '6', 7],
    ]);
  });

  it('with nobody yet, has no column, so the board says so or passes on in a rotation', () => {
    expect(toLeaderboardColumns([])).toEqual([]);
  });
});
