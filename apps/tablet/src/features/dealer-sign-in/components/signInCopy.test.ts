import { describe, expect, it } from 'vitest';
import { signInFailureText } from './signInCopy.ts';

describe('what the tablet says when sign-in does not go through', () => {
  it('counts the tries left after a wrong PIN, and says the last one in words', () => {
    expect(signInFailureText({ reason: 'wrong_pin', triesLeft: 4 })).toBe('Wrong PIN. 4 tries left.');
    expect(signInFailureText({ reason: 'wrong_pin', triesLeft: 1 })).toBe('Wrong PIN. One try left.');
  });

  it('says a PIN is locked, the venue is frozen, or the connection failed', () => {
    expect(signInFailureText({ reason: 'locked' })).toMatch(/^PIN locked for 15 minutes/);
    expect(signInFailureText({ reason: 'paused' })).toBe('Venue frozen. Try again once it is released.');
    expect(signInFailureText({ reason: 'unavailable' })).toBe('Not sent. Try again.');
  });
});
