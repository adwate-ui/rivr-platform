import { describe, expect, it } from 'vitest';
import { bonusLastsDays } from './index.ts';

describe('how long Bonus lasts, for the balance\'s line (redesign RD-20)', () => {
  it('lasts the days the club set', () => {
    expect(bonusLastsDays(1)).toBe(1);
    expect(bonusLastsDays(30)).toBe(30);
    expect(bonusLastsDays(3650)).toBe(3650);
  });

  it('never ends at 0 days, or with nothing set', () => {
    expect(bonusLastsDays(0)).toBeNull();
    expect(bonusLastsDays(null)).toBeNull();
    expect(bonusLastsDays(-1)).toBeNull();
  });
});
