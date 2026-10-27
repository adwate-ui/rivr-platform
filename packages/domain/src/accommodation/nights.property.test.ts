import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { NIGHT, nightsForTime } from './nights.ts';

const seconds = fc.bigInt({ min: 0n, max: 10_000_000n });
const hours = fc.bigInt({ min: 1n, max: 200n });

describe('nightsForTime', () => {
  it('never gives more than the time is worth, and less by under a thousandth', () => {
    fc.assert(fc.property(seconds, hours, (played, perNight) => {
      const thousandths = nightsForTime(played, perNight);
      const whole = perNight * 3_600n;
      expect(thousandths * whole <= played * NIGHT).toBe(true);
      expect((thousandths + 1n) * whole > played * NIGHT).toBe(true);
    }));
  });

  it('never gives less for more time, or more for more hours a night', () => {
    fc.assert(fc.property(seconds, seconds, hours, (a, b, perNight) => {
      const [less, more] = a <= b ? [a, b] : [b, a];
      expect(nightsForTime(less, perNight) <= nightsForTime(more, perNight)).toBe(true);
      expect(nightsForTime(more, perNight + 1n) <= nightsForTime(more, perNight)).toBe(true);
    }));
  });
});
