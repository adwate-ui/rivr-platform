import type { Reward } from '@rivr/contracts/promotionModel';
import { buildMemberFacts, buildPromotionEvent, buildPromotionTerms } from '@rivr/testing';
import { describe, expect, it } from 'vitest';
import { toPromotionEvent } from './grant.ts';
import { simulate, type ReplayedEvent } from './simulation.ts';

const BONUS: Reward = { kind: 'buyin_bonus', mode: 'percent', percent: 20 };
const member = buildMemberFacts();

/** A buy-in of 10,000 own chips by a member at an IST moment, as the replay gives it. */
function buyIn(at: string, memberId: string, more: Partial<{ key: string; tableId: string; tierId: string }> = {}): ReplayedEvent {
  const event = buildPromotionEvent({ kind: 'buy_in', ownChips: 10_000, isFirstOfVisit: true }, {
    at, memberId, key: more.key ?? `${memberId}@${at}`, tableId: more.tableId ?? 'table-1', visitId: `${memberId}-visit`,
  });
  return { event: toPromotionEvent(event), member: { ...member, tierId: more.tierId ?? member.tierId } };
}

describe('simulate', () => {
  it('replays nothing when there were no events', () => {
    expect(simulate(buildPromotionTerms(), [])).toEqual({
      events: 0, membersQualified: 0, timesGiven: 0, points: 0, chips: 0, spins: 0, perks: 0, isBudgetReached: false, grants: [],
    });
  });

  it('gives each qualifying event its reward, and totals them', () => {
    const terms = buildPromotionTerms({ reward: BONUS });
    const result = simulate(terms, [buyIn('2026-11-17T21:00:00+05:30', 'arjun'), buyIn('2026-11-17T22:00:00+05:30', 'kabir'),
      buyIn('2026-11-17T23:00:00+05:30', 'arjun')]);
    expect([result.events, result.membersQualified, result.timesGiven, result.chips, result.points, result.spins, result.perks]).toEqual([3, 2, 3, 6_000, 0, 0, 0]);
  });

  it('gives in time order, then in the order of the keys, however the events came', () => {
    const at = '2026-11-17T21:00:00+05:30';
    const result = simulate(buildPromotionTerms({ reward: BONUS }), [
      buyIn('2026-11-17T22:00:00+05:30', 'zoya', { key: 'a' }), buyIn(at, 'naina', { key: 'c' }), buyIn(at, 'arjun', { key: 'a' }), buyIn(at, 'kabir', { key: 'b' }),
    ]);
    expect(result.grants.map((grant) => grant.memberId)).toEqual(['arjun', 'kabir', 'naina', 'zoya']);
  });

  it('weighs events in time order, so the first N go to the earliest', () => {
    const firstOne = buildPromotionTerms({ reward: { ...BONUS, firstNBuyinsPerTable: 1 } });
    const result = simulate(firstOne, [buyIn('2026-11-17T22:00:00+05:30', 'kabir'), buyIn('2026-11-17T21:00:00+05:30', 'arjun')]);
    expect(result.grants.map((grant) => grant.memberId)).toEqual(['arjun']);
    expect([result.membersQualified, result.timesGiven, result.isBudgetReached]).toEqual([2, 1, false]);
  });

  it('weighs events at the same moment in the order of their keys', () => {
    const firstOne = buildPromotionTerms({ reward: { ...BONUS, firstNBuyinsPerTable: 1 } });
    const at = '2026-11-17T21:00:00+05:30';
    const result = simulate(firstOne, [buyIn(at, 'kabir', { key: 'b' }), buyIn(at, 'arjun', { key: 'a' }), buyIn(at, 'naina', { key: 'c' })]);
    expect(result.grants.map((grant) => grant.memberId)).toEqual(['arjun']);
  });

  it('says when the budget stopped a grant, and gives no part of one', () => {
    const budgeted = buildPromotionTerms({ reward: BONUS, limits: { perMember: 'none', budgetChips: 3_000 } });
    const result = simulate(budgeted, [buyIn('2026-11-17T21:00:00+05:30', 'arjun'), buyIn('2026-11-17T22:00:00+05:30', 'kabir')]);
    expect([result.timesGiven, result.chips, result.isBudgetReached]).toEqual([1, 2_000, true]);
  });

  it('says when the most grants stopped one, but not when a member\'s own limit did', () => {
    const fewest = buildPromotionTerms({ reward: BONUS, limits: { perMember: 'none', maxGrants: 1 } });
    const twoBuyIns = [buyIn('2026-11-17T21:00:00+05:30', 'arjun'), buyIn('2026-11-17T22:00:00+05:30', 'kabir')];
    expect(simulate(fewest, twoBuyIns).isBudgetReached).toBe(true);
    const oncePerDay = buildPromotionTerms({ reward: BONUS, limits: { perMember: 'per_day' } });
    const twiceByOne = [buyIn('2026-11-17T21:00:00+05:30', 'arjun'), buyIn('2026-11-17T22:00:00+05:30', 'arjun'), buyIn('2026-11-18T21:00:00+05:30', 'arjun')];
    const result = simulate(oncePerDay, twiceByOne);
    expect([result.timesGiven, result.membersQualified, result.isBudgetReached]).toEqual([2, 1, false]);
  });

  it('leaves out members who do not qualify', () => {
    const founders = buildPromotionTerms({ reward: BONUS, eligibility: { stakes: 'all', tiers: ['tier-founders'], audience: 'everyone' } });
    const result = simulate(founders, [buyIn('2026-11-17T21:00:00+05:30', 'arjun'), buyIn('2026-11-17T22:00:00+05:30', 'zoya', { tierId: 'tier-founders' })]);
    expect([result.events, result.membersQualified, result.timesGiven]).toEqual([2, 1, 1]);
  });

  it('counts points, spins and perks apart', () => {
    const played = toPromotionEvent(buildPromotionEvent({ kind: 'time_played', minutes: 300, points: 90 }));
    const visit = toPromotionEvent(buildPromotionEvent({ kind: 'visit', visitInMonth: 4 }, { tableId: null, stake: null }));
    expect(simulate(buildPromotionTerms({ reward: { kind: 'points_multiplier', multiplier: 3 } }), [{ event: played, member }]).points).toBe(180);
    expect(simulate(buildPromotionTerms({ reward: { kind: 'free_spin', spins: 2, afterMinutes: 240 } }), [{ event: played, member }]).spins).toBe(2);
    expect(simulate(buildPromotionTerms({ reward: { kind: 'cab_home', fromVisitInMonth: 4 } }), [{ event: visit, member }]).perks).toBe(1);
  });
});
