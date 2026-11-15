import { describe, expect, it } from 'vitest';
import { boardsFor } from './ModeScreen.tsx';

describe('the boards a TV shows', () => {
  it('shows its main board, then those it turns to', () => {
    expect(boardsFor('waitlist', ['call_time', 'promotions'])).toEqual(['waitlist', 'call_time', 'promotions']);
    expect(boardsFor('leaderboard', [])).toEqual(['leaderboard']);
  });
});
