import { describe, expect, it } from 'vitest';
import { boardsFor } from './ModeScreen.tsx';

describe('the boards a TV shows', () => {
  it('shows its main board, then those it turns to', () => {
    expect(boardsFor('waitlist', ['call_time', 'promotions'])).toEqual(['waitlist', 'call_time', 'promotions']);
    expect(boardsFor('league', [])).toEqual(['league']);
  });

  it('shows a TV still set to the jackpot the waitlist board, and passes over the jackpot in a rotation, as the TV shows no rupee', () => {
    expect(boardsFor('jackpot', [])).toEqual(['waitlist']);
    expect(boardsFor('call_time', ['jackpot', 'rewards'])).toEqual(['call_time', 'rewards']);
  });
});
