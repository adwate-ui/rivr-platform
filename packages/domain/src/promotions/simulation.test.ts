import type { Reward } from '@rivr/contracts/promotionModel';
import { buildMemberFacts, buildPromotionEvent, buildPromotionTerms } from '@rivr/testing';
import { describe, expect, it } from 'vitest';
import { toPromotionEvent } from './grant.ts';
import { simulate, type ReplayedEvent } from './simulation.ts';

const BONUS = { kind: 'seat_bonus', chips: 2_000 } as const satisfies Reward;
const member = buildMemberFacts();

/** A member's first seat of a visit at an IST moment, as the replay gives it. */
function seat(at: string, memberId: string, more: Partial<{ key: string; tableId: string; tierId: string }> = {}): ReplayedEvent {
  const event = buildPromotionEvent({ kind: 'seated', isFirstOfVisit: true }, {
    at, memberId, key: more.key ?? `${memberId}@${at}`, tableId: more.tableId ?? 'table-1', visitId: `${memberId}-visit`,
  });
  return { event: toPromotionEvent(event), member: { ...member, tierId: more.tierId ?? member.tierId } };
}

describe('simulate', () => {
  it('replays nothing when there were no events', () => {
    expect(simulate(buildPromotionTerms(), [])).toEqual({
      events: 0, membersQualified: 0, timesGiven: 0, chips: 0, perks: 0, isBudgetReached: false, grants: [],
    });
  });

  it('gives each qualifying event its reward, and totals them', () => {
    const terms = buildPromotionTerms({ reward: BONUS });
    const result = simulate(terms, [seat('2026-11-17T21:00:00+05:30', 'arjun'), seat('2026-11-17T22:00:00+05:30', 'kabir'),
      seat('2026-11-17T23:00:00+05:30', 'arjun')]);
    expect([result.events, result.membersQualified, result.timesGiven, result.chips, result.perks]).toEqual([3, 2, 3, 6_000, 0]);
  });

  it('gives in time order, then in the order of the keys, however the events came', () => {
    const at = '2026-11-17T21:00:00+05:30';
    const result = simulate(buildPromotionTerms({ reward: BONUS }), [
      seat('2026-11-17T22:00:00+05:30', 'zoya', { key: 'a' }), seat(at, 'naina', { key: 'c' }), seat(at, 'arjun', { key: 'a' }), seat(at, 'kabir', { key: 'b' }),
    ]);
    expect(result.grants.map((grant) => grant.memberId)).toEqual(['arjun', 'kabir', 'naina', 'zoya']);
  });

  it('weighs events in time order, so the first N go to the earliest', () => {
    const firstOne = buildPromotionTerms({ reward: { ...BONUS, firstNSeatsPerTable: 1 } });
    const result = simulate(firstOne, [seat('2026-11-17T22:00:00+05:30', 'kabir'), seat('2026-11-17T21:00:00+05:30', 'arjun')]);
    expect(result.grants.map((grant) => grant.memberId)).toEqual(['arjun']);
    expect([result.membersQualified, result.timesGiven, result.isBudgetReached]).toEqual([2, 1, false]);
  });

  it('weighs events at the same moment in the order of their keys', () => {
    const firstOne = buildPromotionTerms({ reward: { ...BONUS, firstNSeatsPerTable: 1 } });
    const at = '2026-11-17T21:00:00+05:30';
    const result = simulate(firstOne, [seat(at, 'kabir', { key: 'b' }), seat(at, 'arjun', { key: 'a' }), seat(at, 'naina', { key: 'c' })]);
    expect(result.grants.map((grant) => grant.memberId)).toEqual(['arjun']);
  });

  it('says when the budget stopped a grant, and gives no part of one', () => {
    const budgeted = buildPromotionTerms({ reward: BONUS, limits: { perMember: 'none', budgetChips: 3_000 } });
    const result = simulate(budgeted, [seat('2026-11-17T21:00:00+05:30', 'arjun'), seat('2026-11-17T22:00:00+05:30', 'kabir')]);
    expect([result.timesGiven, result.chips, result.isBudgetReached]).toEqual([1, 2_000, true]);
  });

  it('says when the most grants stopped one, but not when a member\'s own limit did', () => {
    const fewest = buildPromotionTerms({ reward: BONUS, limits: { perMember: 'none', maxGrants: 1 } });
    const twoSeats = [seat('2026-11-17T21:00:00+05:30', 'arjun'), seat('2026-11-17T22:00:00+05:30', 'kabir')];
    expect(simulate(fewest, twoSeats).isBudgetReached).toBe(true);
    const oncePerDay = buildPromotionTerms({ reward: BONUS, limits: { perMember: 'per_day' } });
    const twiceByOne = [seat('2026-11-17T21:00:00+05:30', 'arjun'), seat('2026-11-17T22:00:00+05:30', 'arjun'), seat('2026-11-18T21:00:00+05:30', 'arjun')];
    const result = simulate(oncePerDay, twiceByOne);
    expect([result.timesGiven, result.membersQualified, result.isBudgetReached]).toEqual([2, 1, false]);
  });

  it('leaves out members who do not qualify', () => {
    const founders = buildPromotionTerms({ reward: BONUS, eligibility: { stakes: 'all', tiers: ['tier-founders'], audience: 'everyone' } });
    const result = simulate(founders, [seat('2026-11-17T21:00:00+05:30', 'arjun'), seat('2026-11-17T22:00:00+05:30', 'zoya', { tierId: 'tier-founders' })]);
    expect([result.events, result.membersQualified, result.timesGiven]).toEqual([2, 1, 1]);
  });

  it('counts a perk as a perk, with no chips', () => {
    const visit = toPromotionEvent(buildPromotionEvent({ kind: 'visit', visitInMonth: 4 }, { tableId: null, stake: null }));
    const result = simulate(buildPromotionTerms({ reward: { kind: 'waitlist_priority' } }), [{ event: visit, member }]);
    expect([result.perks, result.chips]).toEqual([1, 0]);
  });
});
