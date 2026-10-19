import { describe, expect, it } from 'vitest';
import { logFailureText, variantOptions, variantText } from './handCopy.ts';

describe('what the hand entry screen says', () => {
  it('offers PLO and bomb pots only at a table that plays variations', () => {
    expect(variantOptions(true).map((option) => option.label)).toEqual(['Hold\'em', 'PLO', 'Bomb pot']);
    expect(variantOptions(false)).toEqual([{ value: 'holdem', label: 'Hold\'em' }]);
    expect(variantText('bomb_pot')).toBe('Bomb pot');
  });

  it('says why a hand was not logged, and what to do', () => {
    expect(logFailureText('no_dealer')).toBe('No dealer is signed in on this tablet. End the down and sign in again.');
    expect(logFailureText('paused')).toBe('The venue is frozen. Hands are logged again once it is released.');
    expect(logFailureText('invalid')).toMatch(/^That hand was refused\./);
    expect(logFailureText('unavailable')).toBe('The hand was not logged. Check the connection and press Log hand again.');
  });
});
