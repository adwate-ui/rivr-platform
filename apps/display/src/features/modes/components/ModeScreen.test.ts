import { describe, expect, it } from 'vitest';
import { boardsFor } from './ModeScreen.tsx';

describe('the boards a TV shows', () => {
  it('shows its main board, then those it turns to', () => {
    expect(boardsFor('waitlist', ['call_time', 'promotions'])).toEqual(['waitlist', 'call_time', 'promotions']);
    expect(boardsFor('leaderboard', [])).toEqual(['leaderboard']);
  });

  it('shows a TV still set to the jackpot the waitlist board, and passes over the jackpot in a rotation, as the TV shows no rupee', () => {
    expect(boardsFor('jackpot', [])).toEqual(['waitlist']);
    expect(boardsFor('call_time', ['jackpot', 'promotions'])).toEqual(['call_time', 'promotions']);
  });

  it('shows a TV still set to the tournament clock the waitlist board, while tournaments are hidden (D-03)', () => {
    expect(boardsFor('tournament_clock', ['tournament_clock', 'leaderboard'])).toEqual(['waitlist', 'leaderboard']);
  });
});
