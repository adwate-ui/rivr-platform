import { memberFactsSchema, promotionEventSchema, promotionTermsSchema } from '@rivr/contracts/promotionModel';
import { describe, expect, it } from 'vitest';
import { buildMemberFacts, buildPromotionEvent, buildPromotionTerms } from './promotionFactories.ts';

describe('promotion factories', () => {
  it('build terms, a member and events the schemas accept', () => {
    expect(promotionTermsSchema.safeParse(buildPromotionTerms()).success).toBe(true);
    expect(memberFactsSchema.safeParse(buildMemberFacts({ daysSinceLastVisit: null })).success).toBe(true);
    expect(promotionEventSchema.safeParse(buildPromotionEvent({ kind: 'buy_in', ownChips: 10_000, isFirstOfVisit: true })).success).toBe(true);
    expect(promotionEventSchema.safeParse(buildPromotionEvent({ kind: 'signup' }, { tableId: null, stake: null })).success).toBe(true);
  });

  it('let a test name only what it is about', () => {
    expect(buildPromotionTerms({ name: 'Triple points' }).name).toBe('Triple points');
    expect(buildPromotionEvent({ kind: 'visit', visitInMonth: 4 }, { memberId: 'member-2' }).memberId).toBe('member-2');
  });
});
