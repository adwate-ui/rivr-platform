import { CARD_RANKS, HIGH_HANDS, type Limits } from '@rivr/contracts/promotionModel';
import { buildMemberFacts, buildPromotionTerms } from '@rivr/testing';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { PromotionEvent } from './grant.ts';
import { highestHandChips, highHandPayout, type HighHandHit, type HighHandReward } from './highHand.ts';
import { simulate } from './simulation.ts';

const chips = fc.integer({ min: 1, max: 1_000 }).map((fifties) => fifties * 50);
const reward: fc.Arbitrary<HighHandReward> = fc.record({
  hands: fc.uniqueArray(fc.constantFrom(...HIGH_HANDS), { minLength: 1, maxLength: HIGH_HANDS.length })
    .chain((hands) => fc.tuple(...hands.map((hand) => chips.map((amount) => ({ hand, chips: amount }))))),
  rules: fc.record({ bothHoleCards: fc.boolean(), shownAtShowdown: fc.boolean(), minPlayersDealt: fc.integer({ min: 2, max: 10 }) }),
}).map((parts) => ({ kind: 'high_hand', ...parts }));
const hit: fc.Arbitrary<HighHandHit> = fc.record({
  hand: fc.constantFrom(...HIGH_HANDS),
  rank: fc.constantFrom(null, ...CARD_RANKS),
  confirmed: fc.record({ bothHoleCards: fc.boolean(), shownAtShowdown: fc.boolean(), playersDealt: fc.boolean() }),
});

// Tuesday 17 November 2026, 21:00 IST, at Table 1: each hit is an event of its own.
const AT = new Date('2026-11-17T21:00:00+05:30');
const eventOf = (logged: HighHandHit, key: string, memberId: string): PromotionEvent =>
  ({ ...logged, kind: 'high_hand', key, at: AT, memberId, visitId: 'v1', tableId: 't1', stake: 'nlh_100_200' });
const replayed = (logged: readonly HighHandHit[]) =>
  logged.map((one, at) => ({ event: eventOf(one, `high_hand:${String(at)}`, `m${String(at % 3)}`), member: buildMemberFacts() }));
const NO_LIMIT: Limits = { perMember: 'none' };

describe('high hand properties', () => {
  it('pays exactly one listed hand\'s Bonus, or nothing', () => {
    fc.assert(fc.property(reward, hit, (promo, logged) => {
      const payout = highHandPayout(promo, logged);
      if (!payout.ok) return;
      expect(promo.hands).toContainEqual({ hand: payout.value.hand, chips: payout.value.chips });
      expect(payout.value.chips).toBeLessThanOrEqual(highestHandChips(promo));
    }));
  });

  it('never pays a hit with a rule the promotion holds left unconfirmed', () => {
    fc.assert(fc.property(reward, hit, (promo, logged) => {
      const { rules } = promo;
      const isConfirmed = logged.confirmed.playersDealt && (!rules.bothHoleCards || logged.confirmed.bothHoleCards)
        && (!rules.shownAtShowdown || logged.confirmed.shownAtShowdown);
      if (!isConfirmed) expect(highHandPayout(promo, logged).ok).toBe(false);
    }));
  });

  it('pays every hit, the same player twice in a night too, with no budget', () => {
    fc.assert(fc.property(reward, fc.array(hit, { maxLength: 12 }), (promo, logged) => {
      const result = simulate(buildPromotionTerms({ reward: promo, limits: NO_LIMIT }), replayed(logged));
      const payable = logged.map((one) => highHandPayout(promo, one)).flatMap((payout) => (payout.ok ? [payout.value.chips] : []));
      expect(result.timesGiven).toBe(payable.length);
      expect(result.chips).toBe(payable.reduce((total, amount) => total + amount, 0));
    }));
  });

  it('pays a hit logged twice once: a replay changes nothing', () => {
    fc.assert(fc.property(reward, fc.array(hit, { maxLength: 8 }), (promo, logged) => {
      const terms = buildPromotionTerms({ reward: promo, limits: NO_LIMIT });
      const once = simulate(terms, replayed(logged));
      const twice = simulate(terms, [...replayed(logged), ...replayed(logged)]);
      expect([twice.timesGiven, twice.chips]).toEqual([once.timesGiven, once.chips]);
    }));
  });

  it('never pays past the budget, whole hits or none', () => {
    fc.assert(fc.property(reward, chips, fc.array(hit, { maxLength: 12 }), (promo, budget, logged) => {
      const result = simulate(buildPromotionTerms({ reward: promo, limits: { perMember: 'none', budgetChips: budget } }), replayed(logged));
      expect(result.chips).toBeLessThanOrEqual(budget);
      for (const grant of result.grants) expect(promo.hands.map((one) => one.chips)).toContain(grant.chips);
    }));
  });
});
