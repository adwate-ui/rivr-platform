import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { countedSeconds } from './hours.ts';

const at = (iso: string) => new Date(iso);
const STINT = { from: at('2026-11-15T14:00:00Z'), to: at('2026-11-15T17:00:00Z'), playedSeconds: 9600n };

describe('a member’s counted hours after a reset (redesign RD-36)', () => {
  it('counts a stint whole for a member never reset', () => {
    expect(countedSeconds(STINT, null)).toBe(9600n);
  });

  it('counts a stint whole when it began at or after the reset', () => {
    expect(countedSeconds(STINT, at('2026-11-14T09:00:00Z'))).toBe(9600n);
    expect(countedSeconds(STINT, STINT.from)).toBe(9600n);
  });

  it('counts nothing of a stint that ended by the reset', () => {
    expect(countedSeconds(STINT, STINT.to)).toBe(0n);
    expect(countedSeconds(STINT, at('2026-11-16T09:00:00Z'))).toBe(0n);
  });

  it('counts the share played after the reset, by the clock, rounded down', () => {
    expect(countedSeconds(STINT, at('2026-11-15T16:00:00Z'))).toBe(3200n);
    expect(countedSeconds({ ...STINT, playedSeconds: 10_800n }, at('2026-11-15T15:00:00Z'))).toBe(7200n);
    expect(countedSeconds({ from: STINT.from, to: at('2026-11-15T14:50:00Z'), playedSeconds: 2000n }, at('2026-11-15T14:33:20Z'))).toBe(666n);
  });

  it('refuses a stint that ends before it begins', () => {
    expect(() => countedSeconds({ ...STINT, to: at('2026-11-15T13:00:00Z') }, null)).toThrow(RangeError);
  });

  it('never counts more than was played, nor less than nothing, and less the later the reset', () => {
    const cases = fc.record({
      wall: fc.integer({ min: 0, max: 86_400 }), playedShare: fc.integer({ min: 0, max: 100 }),
      early: fc.integer({ min: -3600, max: 90_000 }), later: fc.integer({ min: 0, max: 3600 }),
    });
    fc.assert(fc.property(cases, ({ wall, playedShare, early, later }) => {
      const from = at('2026-11-15T14:00:00Z');
      const stint = { from, to: new Date(from.getTime() + wall * 1000), playedSeconds: BigInt(Math.floor((wall * playedShare) / 100)) };
      const first = countedSeconds(stint, new Date(from.getTime() + early * 1000));
      const second = countedSeconds(stint, new Date(from.getTime() + (early + later) * 1000));
      expect(first >= 0n && first <= stint.playedSeconds).toBe(true);
      expect(second <= first).toBe(true);
    }));
  });
});
