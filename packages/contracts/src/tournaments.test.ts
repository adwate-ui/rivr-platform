import { describe, expect, it } from 'vitest';
import { istMoment, newTournamentSchema } from './tournaments.ts';

describe('a new tournament', () => {
  const typed = { name: ' Diwali Deepstack ', day: '2026-11-15', time: '16:00', game: 'No-Limit Hold’em' };

  it('takes a name, an IST day and time, and a game', () => {
    expect(newTournamentSchema.parse(typed)).toEqual({ ...typed, name: 'Diwali Deepstack' });
  });

  it('refuses a blank or long name, a day or time that is none, and no game', () => {
    expect(newTournamentSchema.safeParse({ ...typed, name: ' ' }).success).toBe(false);
    expect(newTournamentSchema.safeParse({ ...typed, name: 'x'.repeat(81) }).success).toBe(false);
    expect(newTournamentSchema.safeParse({ ...typed, day: '15/11/2026' }).success).toBe(false);
    expect(newTournamentSchema.safeParse({ ...typed, time: '4 pm' }).success).toBe(false);
    expect(newTournamentSchema.safeParse({ ...typed, time: '24:00' }).success).toBe(false);
    expect(newTournamentSchema.safeParse({ ...typed, game: ' ' }).success).toBe(false);
  });

  it('has nowhere for a buy-in, a stake or a prize', () => {
    expect(newTournamentSchema.safeParse({ ...typed, buyIn: '10000' }).success).toBe(false);
    expect(newTournamentSchema.safeParse({ ...typed, stake: '25,000' }).success).toBe(false);
  });

  it('reads its IST day and 24-hour time as the moment it is', () => {
    expect(istMoment('2026-11-15', '16:00').toISOString()).toBe('2026-11-15T10:30:00.000Z');
  });
});
