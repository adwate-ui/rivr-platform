import { buildMemberFacts, buildPromotionTerms } from '@rivr/testing';
import { describe, expect, it } from 'vitest';
import { isAtEligibleTable, isEligible, isTimeBased } from './eligibility.ts';

const TUESDAY_NIGHT = { at: new Date('2026-11-17T21:00:00+05:30'), stake: 'nlh_50_100', tableId: 'table-1' };
const SEAT_BONUS = { kind: 'seat_bonus', chips: 500 } as const;

describe('isTimeBased', () => {
  it('is true for a play-time bonus, the reward measured in time played, and only that', () => {
    expect(isTimeBased({ kind: 'hours_bonus', chips: 1_000, afterMinutes: 240 })).toBe(true);
    expect(isTimeBased(SEAT_BONUS)).toBe(false);
    expect(isTimeBased({ kind: 'waitlist_priority' })).toBe(false);
  });
});

describe('isAtEligibleTable', () => {
  it('takes any table for all stakes, and only listed stakes and tables otherwise', () => {
    expect(isAtEligibleTable({ stakes: 'all', tiers: 'all', audience: 'everyone' }, null, null)).toBe(true);
    expect(isAtEligibleTable({ stakes: ['nlh_50_100'], tiers: 'all', audience: 'everyone' }, 'nlh_50_100', 'table-1')).toBe(true);
    expect(isAtEligibleTable({ stakes: 'all', tableIds: ['table-2'], tiers: 'all', audience: 'everyone' }, 'nlh_50_100', 'table-1')).toBe(false);
    expect(isAtEligibleTable({ stakes: 'all', tableIds: ['table-2'], tiers: 'all', audience: 'everyone' }, 'nlh_50_100', null)).toBe(false);
  });
});

describe('isEligible', () => {
  it('weighs a time-played reward on tier and audience only, whatever the moment or the table', () => {
    const lateNightPlay = buildPromotionTerms({
      eligibility: { stakes: ['nlh_100_200'], tiers: ['tier-founders'], audience: 'everyone' },
      schedule: { days: [5], from: '20:00', to: '22:00', startsOn: '2026-11-01', timezone: 'Asia/Kolkata' },
    });
    expect(isEligible(lateNightPlay, buildMemberFacts({ tierId: 'tier-founders' }), TUESDAY_NIGHT)).toBe(true);
    expect(isEligible(lateNightPlay, buildMemberFacts(), TUESDAY_NIGHT)).toBe(false);
    expect(isEligible({ ...lateNightPlay, eligibility: { ...lateNightPlay.eligibility, audience: 'new_30d' } },
      buildMemberFacts({ tierId: 'tier-founders' }), TUESDAY_NIGHT)).toBe(false);
  });

  it('weighs an event at a moment on its stake, table and moment too', () => {
    const tuesdayBonus = buildPromotionTerms({ reward: SEAT_BONUS, schedule: { days: [2], from: '06:00', to: '06:00', startsOn: '2026-11-01', timezone: 'Asia/Kolkata' } });
    expect(isEligible(tuesdayBonus, buildMemberFacts(), TUESDAY_NIGHT)).toBe(true);
    expect(isEligible(tuesdayBonus, buildMemberFacts(), { ...TUESDAY_NIGHT, at: new Date('2026-11-16T21:00:00+05:30') })).toBe(false);
    const elsewhere = { ...tuesdayBonus, eligibility: { ...tuesdayBonus.eligibility, tableIds: ['table-9'] } };
    expect(isEligible(elsewhere, buildMemberFacts(), TUESDAY_NIGHT)).toBe(false);
  });

  it('counts the 30 days of a new member and of a lapsed regular on whole days', () => {
    const forNew = buildPromotionTerms({ reward: SEAT_BONUS, eligibility: { stakes: 'all', tiers: 'all', audience: 'new_30d' } });
    expect(isEligible(forNew, buildMemberFacts({ daysSinceJoined: 0 }), TUESDAY_NIGHT)).toBe(true);
    const forLapsed = { ...forNew, eligibility: { ...forNew.eligibility, audience: 'lapsed' as const } };
    expect(isEligible(forLapsed, buildMemberFacts({ daysSinceLastVisit: 365 }), TUESDAY_NIGHT)).toBe(true);
  });
});
