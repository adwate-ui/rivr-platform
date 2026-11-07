import { describe, expect, it } from 'vitest';
import { doorQuery } from './doorQuery.ts';

const CARD = 'RIVR-58-1730612400-a3f9c2d1e4b5f6a7b8c9d0e1';

describe('what the door field holds', () => {
  it('reads a membership card as the scanner types it: RIVR, the member’s number, the window and its signature', () => {
    expect(doorQuery(CARD)).toEqual({ kind: 'card', code: CARD });
    // The card id it carried before 8 Nov is no card now.
    expect(doorQuery('1f0c2a4e-6b7d-4c8e-9f10-112233445566.1730612400.a1B2c3D4').kind).not.toBe('card');
  });

  it('reads ten digits, with or without +91, as a mobile number', () => {
    expect(doorQuery('98765 43210')).toEqual({ kind: 'phone', phone: '+919876543210' });
    expect(doorQuery('+919876543210')).toEqual({ kind: 'phone', phone: '+919876543210' });
  });

  it('reads a member number or a name as something to find', () => {
    expect(doorQuery(' 41 ')).toEqual({ kind: 'search', query: '41' });
    expect(doorQuery('Kabir')).toEqual({ kind: 'search', query: 'Kabir' });
  });

  it('reads nothing usable from an empty field or one letter', () => {
    expect(doorQuery('   ')).toEqual({ kind: 'none' });
    expect(doorQuery('k')).toEqual({ kind: 'none' });
  });
});
