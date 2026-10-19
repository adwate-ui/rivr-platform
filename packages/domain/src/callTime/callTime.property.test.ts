import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { callTime } from './callTime.ts';

const SEATED = new Date('2026-11-15T20:00:00+05:30');
const later = (seconds: number) => new Date(SEATED.getTime() + seconds * 1000);
const minutes = fc.integer({ min: 0, max: 24 * 60 });
const seconds = fc.integer({ min: 0, max: 12 * 3600 });

describe('callTime properties', () => {
  it('is never below zero nor above the call time, and complete exactly when nothing is left', () => {
    fc.assert(fc.property(minutes, seconds, seconds, (required, away, played) => {
      const result = callTime({ minutes: required, seatedAt: SEATED, awaySeconds: Math.min(away, played), awaySince: null, leftAt: null }, later(played));
      expect(result.secondsLeft).toBeGreaterThanOrEqual(0);
      expect(result.secondsLeft).toBeLessThanOrEqual(required * 60);
      expect(result.isComplete).toBe(result.secondsLeft === 0);
    }));
  });

  it('stands still while the player is away, and never moves once they have left', () => {
    fc.assert(fc.property(minutes, seconds, seconds, (required, before, after) => {
      const awayNow = { minutes: required, seatedAt: SEATED, awaySeconds: 0, awaySince: later(before), leftAt: null };
      expect(callTime(awayNow, later(before + after))).toEqual(callTime(awayNow, later(before)));
      const gone = { minutes: required, seatedAt: SEATED, awaySeconds: 0, awaySince: null, leftAt: later(before) };
      expect(callTime(gone, later(before + after))).toEqual(callTime(gone, later(before)));
    }));
  });

  it('read at a moment before the player left, is the clock at that moment', () => {
    fc.assert(fc.property(minutes, seconds, fc.integer({ min: 1, max: 3600 }), (required, played, laterBy) => {
      const seated = { minutes: required, seatedAt: SEATED, awaySeconds: 0, awaySince: null, leftAt: null };
      expect(callTime({ ...seated, leftAt: later(played + laterBy) }, later(played))).toEqual(callTime(seated, later(played)));
    }));
  });

  it('counts down one second for each second played', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 24 * 60 }), seconds, (required, played) => {
      const clock = { minutes: required, seatedAt: SEATED, awaySeconds: 0, awaySince: null, leftAt: null };
      expect(callTime(clock, later(played)).secondsLeft).toBe(Math.max(0, required * 60 - played));
    }));
  });
});
