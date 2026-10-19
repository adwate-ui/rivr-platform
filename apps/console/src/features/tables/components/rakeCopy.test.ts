import { fromPaise } from '@rivr/domain/money';
import { describe, expect, it } from 'vitest';
import { rakeFailureText, ruleText, whenOf } from './rakeCopy.ts';

const CHANGE = { settingId: 's2', rateBasisPoints: 475, cap: fromPaise(700000n), effectiveFrom: '2026-10-20T04:30:00Z', reason: 'Weekend cap' };

describe('what the Rake screen says', () => {
  it('writes a rule as its rate and cap, and a change by when it takes effect in IST', () => {
    expect(ruleText(CHANGE)).toBe('4.75% of the pot, cap ₹7,000');
    expect(ruleText({ ...CHANGE, rateBasisPoints: 500 })).toBe('5% of the pot, cap ₹7,000');
    expect(whenOf(CHANGE)).toEqual({ date: '20 Oct 2026', time: '10:00' });
  });

  it('says why a change did not go through', () => {
    expect(rakeFailureText('not_allowed')).toBe('Your role does not allow this.');
    expect(rakeFailureText('invalid')).toMatch(/^That change was refused\. A change takes effect from now or later/);
    expect(rakeFailureText('in_force')).toBe('That change is already in force, so it stays. Schedule another to replace it.');
    expect(rakeFailureText('unavailable')).toBe('That did not go through. Check the connection and try again.');
  });
});
