import type { Limits, Reward } from '@rivr/contracts/promotionModel';
import { buildPromotionTerms } from '@rivr/testing';
import { describe, expect, it } from 'vitest';
import { cardWords, describePromotion, whoAndWhen } from './describe.ts';

const rewardLine = (reward: Reward) => describePromotion(buildPromotionTerms({ reward })).split(', for ')[0];

describe('describePromotion', () => {
  it('says the whole promotion in one line, in chips and points', () => {
    const tuesday = buildPromotionTerms({
      reward: { kind: 'buyin_bonus', mode: 'percent', percent: 20, capChips: 2_000, firstNBuyinsPerTable: 5 },
      schedule: { days: [2], from: '06:00', to: '06:00', startsOn: '2026-11-17', timezone: 'Asia/Kolkata' },
      limits: { perMember: 'none', budgetChips: 50_000 },
    });
    expect(describePromotion(tuesday)).toBe(
      '20% buy-in bonus, up to 2,000, first 5 buy-ins per table, for all stakes, Tue, all day. No limit per member, budget 50,000 chips. '
      + 'Starts 17 Nov 2026, no end date.',
    );
  });

  it('names stakes, tables and tiers, and the audience, when given', () => {
    const weekend = buildPromotionTerms({
      reward: { kind: 'points_multiplier', multiplier: 3 },
      eligibility: { stakes: ['nlh_100_200'], tableIds: ['t3'], tiers: ['tier-black'], audience: 'new_30d' },
      schedule: { days: [6, 5], from: '20:00', to: '02:00', startsOn: '2026-11-06', endsOn: '2026-12-31', timezone: 'Asia/Kolkata' },
      limits: { perMember: 'per_visit', maxMembersPerDay: 50, maxGrants: 1_000 },
    });
    expect(describePromotion(weekend, { stakes: { nlh_100_200: 'NLH 100/200' }, tiers: { 'tier-black': 'Black card' } })).toBe(
      '3× points, for NLH 100/200 · t3 · Black card · new members, first 30 days, Fri, Sat 20:00–02:00. Once per visit per member, first 50 members a day, '
      + 'at most 1,000 times. Starts 6 Nov 2026, ends 31 Dec 2026.',
    );
  });

  it('says up to N times a member in a period, and a budget and most grants each month (decision 0499)', () => {
    const limitsLine = (limits: Limits) => describePromotion(buildPromotionTerms({ limits })).split('. ')[1];
    expect(limitsLine({ perMember: 'per_day', timesPerMember: 2 })).toBe('Up to 2 times a day per member');
    expect(limitsLine({ perMember: 'once', timesPerMember: 3 })).toBe('Up to 3 times ever per member');
    expect(limitsLine({ perMember: 'per_visit', timesPerMember: 2 })).toBe('Up to 2 times per visit per member');
    expect(limitsLine({ perMember: 'per_week', timesPerMember: 4, budgetChips: 10_000, maxGrants: 300, budgetPeriod: 'month' }))
      .toBe('Up to 4 times a week per member, at most 300 times a month, budget 10,000 chips a month');
  });

  it('says each reward plainly', () => {
    expect(rewardLine({ kind: 'buyin_bonus', mode: 'percent', percent: 10 })).toBe('10% buy-in bonus');
    expect(rewardLine({ kind: 'buyin_bonus', mode: 'fixed', chips: 500 })).toBe('500 bonus chips on a buy-in');
    expect(rewardLine({ kind: 'buyin_bonus', mode: 'fixed', chips: 500, firstNBuyinsPerTable: 3 })).toBe('500 bonus chips on a buy-in, first 3 buy-ins per table');
    expect(rewardLine({ kind: 'hours_bonus', chips: 1_000, afterMinutes: 240 })).toBe('1,000 bonus chips after 4 hours');
    expect(rewardLine({ kind: 'hours_bonus', chips: 1_00_000, afterMinutes: 60 })).toBe('1,00,000 bonus chips after 1 hour');
    expect(rewardLine({ kind: 'bonus_chips', chips: 1_000, on: 'referral' })).toBe('1,000 bonus chips for each referral');
    expect(rewardLine({ kind: 'bonus_chips', chips: 500, on: 'first_buyin' })).toBe('500 bonus chips on the first buy-in of a visit');
    expect(rewardLine({ kind: 'free_spin', spins: 1, afterMinutes: 90 })).toBe('1 free spin after 1.5 hours');
    expect(rewardLine({ kind: 'free_spin', spins: 2, afterMinutes: 240 })).toBe('2 free spins after 4 hours');
    expect(rewardLine({ kind: 'cab_home', fromVisitInMonth: 4 })).toBe('A cab home from visit 4 in a month');
    expect(rewardLine({ kind: 'tournament_entry', tournamentId: 'RIVR Sunday' })).toBe('An entry to RIVR Sunday');
    expect(rewardLine({ kind: 'waitlist_priority' })).toBe('First call on every waitlist');
    expect(rewardLine({ kind: 'points_multiplier', multiplier: 1.25 })).toBe('1.25× points');
  });

  it('names a tournament by its name, and a 24-hour opening by its start', () => {
    const entry = buildPromotionTerms({
      reward: { kind: 'tournament_entry', tournamentId: 'tour-1' },
      schedule: { days: [1, 2, 3, 4, 5, 6, 7], from: '14:00', to: '14:00', startsOn: '2026-11-01', timezone: 'Asia/Kolkata' },
      limits: { perMember: 'once' },
    });
    expect(describePromotion(entry, { tournaments: { 'tour-1': 'Graduate freeroll' } })).toBe(
      'An entry to Graduate freeroll, for all stakes, every day, 24 hours from 14:00. Once ever per member. Starts 1 Nov 2026, no end date.',
    );
    const weekly = buildPromotionTerms({ limits: { perMember: 'per_week' } });
    expect(describePromotion(weekly)).toContain('every day, all day. Once a week per member.');
    expect(describePromotion(buildPromotionTerms({ limits: { perMember: 'per_day' } }))).toContain('Once a day per member.');
  });
});

describe('cardWords', () => {
  it('gives a card what it gives, and who and when, cut to fit the card', () => {
    const tuesday = buildPromotionTerms({
      reward: { kind: 'buyin_bonus', mode: 'percent', percent: 20, capChips: 2_000 },
      eligibility: { stakes: ['nlh_100_200'], tiers: 'all', audience: 'everyone' },
      schedule: { days: [2], from: '20:00', to: '02:00', startsOn: '2026-11-17', timezone: 'Asia/Kolkata' },
    });
    expect(cardWords(tuesday, { stakes: { nlh_100_200: 'NLH 100/200' } })).toEqual({
      detail: '20% buy-in bonus, up to 2,000', runs: 'NLH 100/200 · Tue 20:00–02:00',
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
