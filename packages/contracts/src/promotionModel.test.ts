import { describe, expect, it } from 'vitest';
import {
  eligibilitySchema, limitsSchema, memberFactsSchema, promotionEventSchema, promotionTermsSchema, promotionVersionReplaySchema, rewardSchema,
  scheduleSchema,
} from './promotionModel.ts';

const SCHEDULE = { days: [5, 6], from: '20:00', to: '02:00', startsOn: '2026-11-06', timezone: 'Asia/Kolkata' } as const;
const TERMS = {
  name: 'Weekend triple points',
  reward: { kind: 'points_multiplier', multiplier: 3 },
  eligibility: { stakes: ['nlh_100_200'], tiers: 'all', audience: 'everyone' },
  schedule: SCHEDULE,
  limits: { perMember: 'per_visit' },
  channels: { playerApp: true, tv: true, website: false, whatsapp: false },
  rulesText: ['Points earned between 20:00 and 02:00 count three times.'],
} as const;

describe('the promotion model schemas', () => {
  it('takes a multiplier from 1.25 to 5 in quarters', () => {
    expect(rewardSchema.safeParse({ kind: 'points_multiplier', multiplier: 1.25 }).success).toBe(true);
    expect(rewardSchema.safeParse({ kind: 'points_multiplier', multiplier: 5 }).success).toBe(true);
    expect(rewardSchema.safeParse({ kind: 'points_multiplier', multiplier: 1 }).success).toBe(false);
    expect(rewardSchema.safeParse({ kind: 'points_multiplier', multiplier: 2.1 }).success).toBe(false);
    expect(rewardSchema.safeParse({ kind: 'points_multiplier', multiplier: 5.25 }).success).toBe(false);
  });

  it('takes a buy-in bonus as a percent with an optional cap, or as fixed chips, in whole 50s', () => {
    expect(rewardSchema.safeParse({ kind: 'buyin_bonus', mode: 'percent', percent: 20, capChips: 2_000, firstNBuyinsPerTable: 5 }).success).toBe(true);
    expect(rewardSchema.safeParse({ kind: 'buyin_bonus', mode: 'percent', percent: 20 }).success).toBe(true);
    expect(rewardSchema.safeParse({ kind: 'buyin_bonus', mode: 'fixed', chips: 500 }).success).toBe(true);
    expect(rewardSchema.safeParse({ kind: 'buyin_bonus', mode: 'fixed', chips: 520 }).success).toBe(false);
    expect(rewardSchema.safeParse({ kind: 'buyin_bonus', mode: 'percent', percent: 0 }).success).toBe(false);
    expect(rewardSchema.safeParse({ kind: 'buyin_bonus', mode: 'fixed', chips: 500, percent: 10 }).success).toBe(false);
  });

  it('takes every other reward with its own fields, and refuses an unknown one', () => {
    expect(rewardSchema.safeParse({ kind: 'hours_bonus', chips: 1_000, afterMinutes: 240 }).success).toBe(true);
    expect(rewardSchema.safeParse({ kind: 'hours_bonus', chips: 1_000, afterMinutes: 245 }).success).toBe(false);
    expect(rewardSchema.safeParse({ kind: 'bonus_chips', chips: 1_000, on: 'referral' }).success).toBe(true);
    expect(rewardSchema.safeParse({ kind: 'bonus_chips', chips: 1_000, on: 'birthday' }).success).toBe(false);
    expect(rewardSchema.safeParse({ kind: 'free_spin', spins: 1, afterMinutes: 240 }).success).toBe(true);
    expect(rewardSchema.safeParse({ kind: 'cab_home', fromVisitInMonth: 4 }).success).toBe(true);
    expect(rewardSchema.safeParse({ kind: 'tournament_entry', tournamentId: 'RIVR Sunday' }).success).toBe(true);
    expect(rewardSchema.safeParse({ kind: 'waitlist_priority' }).success).toBe(true);
    expect(rewardSchema.safeParse({ kind: 'cash', amount: 100 }).success).toBe(false);
  });

  it('takes all stakes and tiers, or a list of them, and three audiences, none of them women', () => {
    expect(eligibilitySchema.safeParse({ stakes: 'all', tiers: 'all', audience: 'lapsed' }).success).toBe(true);
    expect(eligibilitySchema.safeParse({ stakes: ['nlh_50_100'], tableIds: ['t1'], tiers: ['tier-1'], audience: 'new_30d' }).success).toBe(true);
    expect(eligibilitySchema.safeParse({ stakes: 'all', tiers: 'all', audience: 'women' }).success).toBe(false);
    expect(eligibilitySchema.safeParse({ stakes: [], tiers: 'all', audience: 'everyone' }).success).toBe(false);
    expect(eligibilitySchema.safeParse({ stakes: 'all', tiers: 'all', audience: 'vip' }).success).toBe(false);
  });

  it('takes a window across midnight, and an end no earlier than the start', () => {
    expect(scheduleSchema.safeParse(SCHEDULE).success).toBe(true);
    expect(scheduleSchema.safeParse({ ...SCHEDULE, endsOn: '2026-11-06' }).success).toBe(true);
    expect(scheduleSchema.safeParse({ ...SCHEDULE, endsOn: '2026-11-05' }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...SCHEDULE, days: [] }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...SCHEDULE, days: [5, 5] }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...SCHEDULE, from: '24:00' }).success).toBe(false);
    expect(scheduleSchema.safeParse({ ...SCHEDULE, timezone: 'UTC' }).success).toBe(false);
  });

  it('takes limits per member, members a day, a budget in whole 50s of chips and a most grants', () => {
    expect(limitsSchema.safeParse({ perMember: 'once', maxMembersPerDay: 50, budgetChips: 50_000, maxGrants: 200 }).success).toBe(true);
    expect(limitsSchema.safeParse({ perMember: 'per_week' }).success).toBe(true);
    expect(limitsSchema.safeParse({ perMember: 'per_month' }).success).toBe(false);
    expect(limitsSchema.safeParse({ perMember: 'none', budgetChips: 75 }).success).toBe(false);
  });

  it('takes up to 2 to 20 times a member in a period, and a budget or most grants afresh each month (decision 0499)', () => {
    expect(limitsSchema.safeParse({ perMember: 'per_day', timesPerMember: 2 }).success).toBe(true);
    expect(limitsSchema.safeParse({ perMember: 'once', timesPerMember: 20 }).success).toBe(true);
    expect(limitsSchema.safeParse({ perMember: 'per_day', timesPerMember: 1 }).success).toBe(false);
    expect(limitsSchema.safeParse({ perMember: 'per_day', timesPerMember: 21 }).success).toBe(false);
    expect(limitsSchema.safeParse({ perMember: 'none', timesPerMember: 2 }).success).toBe(false);
    expect(limitsSchema.safeParse({ perMember: 'none', budgetChips: 10_000, budgetPeriod: 'month' }).success).toBe(true);
    expect(limitsSchema.safeParse({ perMember: 'none', maxGrants: 100, budgetPeriod: 'month' }).success).toBe(true);
    expect(limitsSchema.safeParse({ perMember: 'none', budgetPeriod: 'month' }).success).toBe(false);
    expect(limitsSchema.safeParse({ perMember: 'none', budgetChips: 10_000, budgetPeriod: 'week' }).success).toBe(false);
  });

  it('takes whole terms, with at most twelve rules', () => {
    expect(promotionTermsSchema.safeParse(TERMS).success).toBe(true);
    expect(promotionTermsSchema.safeParse({ ...TERMS, rulesText: Array.from({ length: 13 }, () => 'A rule') }).success).toBe(false);
    expect(promotionTermsSchema.safeParse({ ...TERMS, name: 'No' }).success).toBe(false);
  });

  it('takes a plain https link for the card, and nothing that hides its host', () => {
    expect(promotionTermsSchema.safeParse({ ...TERMS, link: 'https://rivr.club/promotions?from=tv' }).success).toBe(true);
    expect(promotionTermsSchema.safeParse({ ...TERMS, link: 'http://rivr.club' }).success).toBe(false);
    expect(promotionTermsSchema.safeParse({ ...TERMS, link: 'https://rivr.club@elsewhere.example' }).success).toBe(false);
  });

  it('reads an event of each kind, and the member it is for', () => {
    const base = { key: 'buy_in:1', at: '2026-11-17T21:00:00+05:30', memberId: 'm1', visitId: 'v1', tableId: 't1', stake: 'nlh_50_100' };
    expect(promotionEventSchema.safeParse({ ...base, kind: 'buy_in', ownChips: 10_000, isFirstOfVisit: true }).success).toBe(true);
    expect(promotionEventSchema.safeParse({ ...base, kind: 'time_played', minutes: 240, points: 120 }).success).toBe(true);
    expect(promotionEventSchema.safeParse({ ...base, kind: 'visit', visitInMonth: 4 }).success).toBe(true);
    expect(promotionEventSchema.safeParse({ ...base, kind: 'signup' }).success).toBe(true);
    expect(promotionEventSchema.safeParse({ ...base, kind: 'buy_in', ownChips: -1, isFirstOfVisit: true }).success).toBe(false);
    expect(promotionEventSchema.safeParse({ ...base, kind: 'referral', extra: 1 }).success).toBe(false);
    expect(memberFactsSchema.safeParse({ tierId: null, daysSinceJoined: 3, daysSinceLastVisit: null }).success).toBe(true);
  });

  it('reads a replay as the database gives it, with microseconds and offsets', () => {
    const replay = {
      from: '2026-10-27T00:30:00+00:00', to: '2026-11-03T00:30:00+00:00',
      events: [{
        event: { at: '2026-10-31T10:48:00.044839+00:00', key: 'visit:1', kind: 'visit', stake: null, tableId: null, visitId: 'v1', memberId: 'm3', visitInMonth: 3 },
        member: { tierId: 'd50d783c-ad4a-4bb4-b613-59edbf9f9587', daysSinceJoined: 0, daysSinceLastVisit: 7 },
      }],
    };
    expect(promotionVersionReplaySchema.safeParse(replay).success).toBe(true);
    expect(promotionVersionReplaySchema.safeParse({ ...replay, events: [{ event: replay.events[0]?.event }] }).success).toBe(false);
  });

  // Decision 0580: tiers count claims over the promotion's life, each member once.
  it('takes a seat bonus in tiers once a member only, never up to N times or afresh each month, in one to ten tiers', () => {
    const tiers = (count: number) => ({ kind: 'seat_bonus', tiers: Array.from({ length: count }, () => ({ count: 10, chips: 1_000 })) });
    const tiered = (limits: object, reward: object = tiers(2)) => promotionTermsSchema.safeParse({ ...TERMS, reward, limits }).success;
    expect(tiered({ perMember: 'once' })).toBe(true);
    expect(tiered({ perMember: 'once', budgetChips: 50_000 })).toBe(true);
    expect(tiered({ perMember: 'per_visit' })).toBe(false);
    expect(tiered({ perMember: 'once', timesPerMember: 3 })).toBe(false);
    expect(tiered({ perMember: 'once', budgetChips: 50_000, budgetPeriod: 'month' })).toBe(false);
    expect(tiered({ perMember: 'once' }, tiers(0))).toBe(false);
    expect(tiered({ perMember: 'once' }, tiers(11))).toBe(false);
    expect(tiered({ perMember: 'once' }, { kind: 'seat_bonus', tiers: [{ count: 0, chips: 1_000 }] })).toBe(false);
    expect(tiered({ perMember: 'once' }, { kind: 'seat_bonus', chips: 1_000, tiers: [{ count: 10, chips: 1_000 }] })).toBe(false);
  });
});
