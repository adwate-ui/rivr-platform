import { buildPromotionTerms } from '@rivr/testing';
import { describe, expect, it } from 'vitest';
import { sameTerms } from './terms.ts';

describe('sameTerms', () => {
  it('reads terms built in another key order, or renamed, as the same', () => {
    const terms = buildPromotionTerms({ limits: { perMember: 'none', budgetChips: 5_000 } });
    const reordered = { ...terms, limits: { budgetChips: 5_000, perMember: 'none' as const }, name: 'Renamed', rulesText: ['A new rule'] };
    expect(sameTerms(terms, reordered)).toBe(true);
  });

  it('reads a field left out and one set to nothing as the same', () => {
    const terms = buildPromotionTerms();
    expect(sameTerms(terms, { ...terms, schedule: { ...terms.schedule, endsOn: undefined } })).toBe(true);
  });

  it('reads any change to the reward, who, when or the limits as different', () => {
    const terms = buildPromotionTerms();
    expect(sameTerms(terms, { ...terms, reward: { kind: 'points_multiplier', multiplier: 3 } })).toBe(false);
    expect(sameTerms(terms, { ...terms, eligibility: { ...terms.eligibility, audience: 'lapsed' } })).toBe(false);
    expect(sameTerms(terms, { ...terms, schedule: { ...terms.schedule, days: [7, 1, 2, 3, 4, 5, 6] } })).toBe(false);
    expect(sameTerms(terms, { ...terms, limits: { perMember: 'once' } })).toBe(false);
    expect(sameTerms(terms, { ...terms, eligibility: { ...terms.eligibility, tableIds: ['t1'] } })).toBe(false);
  });
});
