import { describe, expect, it } from 'vitest';
import { signInFailureText } from './signInCopy.ts';

describe('what the tablet says when sign-in does not go through', () => {
  it('counts the tries left after a wrong PIN, and says the last one in words', () => {
    expect(signInFailureText({ reason: 'wrong_pin', triesLeft: 4 })).toBe('That PIN is not right. 4 tries left before it locks.');
    expect(signInFailureText({ reason: 'wrong_pin', triesLeft: 1 })).toBe('That PIN is not right. One try left before it locks.');
  });

  it('says a PIN is locked, the venue is frozen, or the connection failed', () => {
    expect(signInFailureText({ reason: 'locked' })).toMatch(/^Too many wrong PINs\./);
    expect(signInFailureText({ reason: 'paused' })).toBe('The venue is frozen. Dealers sign in again once it is released.');
    expect(signInFailureText({ reason: 'unavailable' })).toBe('That did not go through. Check the connection and try again.');
  });
});
