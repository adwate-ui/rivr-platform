import type { Limits, PromotionTerms, Reward } from '@rivr/contracts/promotionModel';
import { describe, expect, it } from 'vitest';
import { cardWords, describePromotion, whoAndWhen } from './promotionWords.ts';

const buildPromotionTerms = (overrides: Partial<PromotionTerms>): PromotionTerms => ({
  name: 'Seat bonus',
  reward: { kind: 'seat_bonus', chips: 500 },
  eligibility: { stakes: 'all', tiers: 'all', audience: 'everyone' },
  schedule: { days: [1, 2, 3, 4, 5, 6, 7], from: '06:00', to: '06:00', startsOn: '2026-11-01', timezone: 'Asia/Kolkata' },
  limits: { perMember: 'none' },
  channels: { playerApp: true, tv: true, website: false, whatsapp: false },
  rulesText: [],
  ...overrides,
});

const rewardLine = (reward: Reward) => describePromotion(buildPromotionTerms({ reward })).split(', for ')[0];

describe('describePromotion', () => {
  it('says the whole promotion in one line, in chips', () => {
    const tuesday = buildPromotionTerms({
      reward: { kind: 'seat_bonus', chips: 1_000, firstNSeatsPerTable: 5 },
      schedule: { days: [2], from: '06:00', to: '06:00', startsOn: '2026-11-17', timezone: 'Asia/Kolkata' },
      limits: { perMember: 'none', budgetChips: 50_000 },
    });
    expect(describePromotion(tuesday)).toBe(
      '1,000 Bonus for the first 5 seated at a table, for all stakes, Tue, all day. No limit per member, budget 50,000 Bonus. '
      + 'Starts 17 Nov 2026, no end date.',
    );
  });

  it('names stakes, tables and tiers, and the audience, when given', () => {
    const weekend = buildPromotionTerms({
      reward: { kind: 'seat_bonus', chips: 500, firstNSeatsPerTable: 5 },
      eligibility: { stakes: ['nlh_100_200'], tableIds: ['t3'], tiers: ['tier-black'], audience: 'new_30d' },
      schedule: { days: [6, 5], from: '20:00', to: '02:00', startsOn: '2026-11-06', endsOn: '2026-12-31', timezone: 'Asia/Kolkata' },
      limits: { perMember: 'per_visit', maxMembersPerDay: 50, maxGrants: 1_000 },
    });
    expect(describePromotion(weekend, { stakes: { nlh_100_200: 'NLH 100/200' }, tiers: { 'tier-black': 'Black card' } })).toBe(
      '500 Bonus for the first 5 seated at a table, for NLH 100/200 · t3 · Black card · new members, first 30 days, Fri, Sat 20:00–02:00. Once per visit per member, first 50 members a day, '
      + 'at most 1,000 times. Starts 6 Nov 2026, ends 31 Dec 2026.',
    );
  });

  it('says up to N times a member in a period, and a budget and most grants each month (decision 0499)', () => {
    const limitsLine = (limits: Limits) => describePromotion(buildPromotionTerms({ limits })).split('. ')[1];
    expect(limitsLine({ perMember: 'per_day', timesPerMember: 2 })).toBe('Up to 2 times a day per member');
    expect(limitsLine({ perMember: 'once', timesPerMember: 3 })).toBe('Up to 3 times ever per member');
    expect(limitsLine({ perMember: 'per_visit', timesPerMember: 2 })).toBe('Up to 2 times per visit per member');
    expect(limitsLine({ perMember: 'per_week', timesPerMember: 4, budgetChips: 10_000, maxGrants: 300, budgetPeriod: 'month' }))
      .toBe('Up to 4 times a week per member, at most 300 times a month, budget 10,000 Bonus a month');
  });

  it('says each reward plainly', () => {
    expect(rewardLine({ kind: 'hours_bonus', chips: 1_000, afterMinutes: 240 })).toBe('1,000 Bonus after 4 hours');
    expect(rewardLine({ kind: 'hours_bonus', chips: 1_00_000, afterMinutes: 60 })).toBe('1,00,000 Bonus after 1 hour');
    // Paid as each step is reached (owner, 8 Nov): set steps, or every so often with or without a cap.
    expect(rewardLine({ kind: 'hours_bonus', mode: 'steps', steps: [{ afterMinutes: 120, chips: 500 }, { afterMinutes: 240, chips: 1_000 }] }))
      .toBe('500 Bonus after 2 hours, then 1,000 after 4 hours');
    expect(rewardLine({ kind: 'hours_bonus', mode: 'every', everyMinutes: 120, chips: 500, timesPerVisit: 3 }))
      .toBe('500 Bonus every 2 hours, up to 3 times a visit');
    expect(rewardLine({ kind: 'hours_bonus', mode: 'every', everyMinutes: 60, chips: 250 })).toBe('250 Bonus every hour');
    expect(rewardLine({ kind: 'hours_bonus', mode: 'every', everyMinutes: 90, chips: 250, timesPerVisit: 1 }))
      .toBe('250 Bonus every 1 h 30 min, up to once a visit');
    expect(rewardLine({ kind: 'bonus_chips', chips: 1_000, on: 'referral' })).toBe('1,000 Bonus for each referral');
    expect(rewardLine({
      kind: 'high_hand', hands: [{ hand: 'four_of_a_kind', chips: 5_000 }, { hand: 'royal_flush', chips: 25_000 }],
      rules: { bothHoleCards: true, shownAtShowdown: true, minPlayersDealt: 4 },
    })).toBe('Four of a kind 5,000, Royal flush 25,000 Bonus, paid each time');
    expect(rewardLine({ kind: 'waitlist_priority' })).toBe('Front of every waitlist');
    expect(rewardLine({ kind: 'seat_bonus', chips: 1_000 })).toBe('1,000 Bonus on the first seat of a visit');
    expect(rewardLine({ kind: 'seat_bonus', chips: 500, firstNSeatsPerTable: 5 })).toBe('500 Bonus for the first 5 seated at a table');
  });

  it('says a high hand hand by hand in its one line, and by the most it pays on its card (redesign RD-23)', () => {
    const highHand = buildPromotionTerms({
      reward: {
        kind: 'high_hand', rules: { bothHoleCards: true, shownAtShowdown: true, minPlayersDealt: 4 },
        hands: [{ hand: 'royal_flush', chips: 25_000 }, { hand: 'straight_flush', chips: 10_000 }, { hand: 'full_house', chips: 1_000 }],
      },
      limits: { perMember: 'none', budgetChips: 200_000, budgetPeriod: 'month' },
    });
    expect(describePromotion(highHand)).toBe(
      'Royal flush 25,000, Straight flush 10,000, Any full house 1,000 Bonus, paid each time, for all stakes, every day, all day. '
      + 'No limit per member, budget 2,00,000 Bonus a month. Starts 1 Nov 2026, no end date.',
    );
    expect(cardWords(highHand).detail).toBe('Up to 25,000 Bonus a hand');
  });

  it('says a 24-hour opening by its start', () => {
    const priority = buildPromotionTerms({
      reward: { kind: 'waitlist_priority' },
      schedule: { days: [1, 2, 3, 4, 5, 6, 7], from: '14:00', to: '14:00', startsOn: '2026-11-01', timezone: 'Asia/Kolkata' },
      limits: { perMember: 'once' },
    });
    expect(describePromotion(priority)).toBe(
      'Front of every waitlist, for all stakes, every day, 24 hours from 14:00. Once ever per member. Starts 1 Nov 2026, no end date.',
    );
    const weekly = buildPromotionTerms({ limits: { perMember: 'per_week' } });
    expect(describePromotion(weekly)).toContain('every day, all day. Once a week per member.');
    expect(describePromotion(buildPromotionTerms({ limits: { perMember: 'per_day' } }))).toContain('Once a day per member.');
  });
});

describe('cardWords', () => {
  it('gives a card what it gives, and who and when, cut to fit the card', () => {
    const tuesday = buildPromotionTerms({
      reward: { kind: 'seat_bonus', chips: 1_000, firstNSeatsPerTable: 5 },
      eligibility: { stakes: ['nlh_100_200'], tiers: 'all', audience: 'everyone' },
      schedule: { days: [2], from: '20:00', to: '02:00', startsOn: '2026-11-17', timezone: 'Asia/Kolkata' },
    });
    expect(cardWords(tuesday, { stakes: { nlh_100_200: 'NLH 100/200' } })).toEqual({
      detail: '1,000 Bonus for the first 5 seated at a table', runs: 'NLH 100/200 · Tue 20:00–02:00',
    });
    const long = buildPromotionTerms({ eligibility: { stakes: 'all', tiers: Array.from({ length: 30 }, (_, n) => `tier-number-${n}`), audience: 'everyone' } });
    expect(cardWords(long).runs).toHaveLength(120);
    expect(cardWords(long).runs.endsWith('…')).toBe(true);
  });
});

describe('whoAndWhen', () => {
  it('gives who it is for and when it runs apart, named as the summary names them', () => {
    const weekend = buildPromotionTerms({
      eligibility: { stakes: ['nlh_100_200'], tiers: ['tier-black'], audience: 'lapsed' },
      schedule: { days: [6, 5], from: '20:00', to: '02:00', startsOn: '2026-11-06', timezone: 'Asia/Kolkata' },
    });
    expect(whoAndWhen(weekend, { stakes: { nlh_100_200: 'NLH 100/200' }, tiers: { 'tier-black': 'Black card' } })).toEqual({
      who: 'NLH 100/200 · Black card · lapsed regulars', when: 'Fri, Sat 20:00–02:00',
    });
    expect(whoAndWhen(buildPromotionTerms({}))).toEqual({ who: 'all stakes', when: 'every day, all day' });
  });
});
