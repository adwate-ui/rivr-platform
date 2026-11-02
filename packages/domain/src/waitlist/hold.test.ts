import { describe, expect, it } from 'vitest';
import { holdFraction } from './index.ts';

const called = new Date('2026-11-15T17:00:00Z');
const until = new Date('2026-11-15T17:20:00Z');

describe('a called seat\'s hold (decision 0320)', () => {
  it('drains from full at the call to empty at the end of the hold', () => {
    expect(holdFraction(called, until, called)).toBe(1);
    expect(holdFraction(called, until, new Date('2026-11-15T17:10:00Z'))).toBe(0.5);
    expect(holdFraction(called, until, until)).toBe(0);
  });

  it('stays between empty and full on a phone whose clock is off', () => {
    expect(holdFraction(called, until, new Date('2026-11-15T16:59:00Z'))).toBe(1);
    expect(holdFraction(called, until, new Date('2026-11-15T17:30:00Z'))).toBe(0);
  });

  it('is empty for a hold with no length', () => {
    expect(holdFraction(until, until, called)).toBe(0);
    expect(holdFraction(until, called, called)).toBe(0);
  });
});
