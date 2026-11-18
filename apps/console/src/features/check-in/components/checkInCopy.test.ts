import { describe, expect, it } from 'vitest';
import { checkOutRefusalText } from './checkInCopy.ts';

describe('a refused check-out in words', () => {
  it('says the call time still owed, or that none was set once the countdown is done', () => {
    expect(checkOutRefusalText({ reason: 'call_time_owed', owedSeconds: 1800 })).toBe('30 min call time owed. An admin can release them on the Live floor.');
    expect(checkOutRefusalText({ reason: 'call_time_owed', owedSeconds: 0 })).toBe('Call time not set. An admin can release them on the Live floor.');
  });
});
