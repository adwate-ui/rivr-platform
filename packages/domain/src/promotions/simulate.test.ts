import { describe, expect, it } from 'vitest';
import { fromPaise } from '../money/index.ts';
import type { PromotionDraft } from './builder.ts';
import { simulatePromotion, type ReplayEvent } from './simulate.ts';

const DOUBLE_POINTS = { kind: 'points', multiplier_percent: 200 } as const;
const BONUS = { kind: 'bonus', percent_bps: 1_000, expires_days: 7 } as const;

function eventAt(at: string, more: Partial<ReplayEvent> = {}): ReplayEvent {
  return {
    at: new Date(at), memberId: 'arjun', tierId: 'member', tableId: 't1', stake: 'nlh_25_50',
    amount: fromPaise(0n), points: 0n, hoursPlayed: 0, ...more,
  };
}

function draft(rule: PromotionDraft['rule'], perPlayer: PromotionDraft['perPlayer'] = null): PromotionDraft {
  return { rule, perPlayer };
}

describe('simulatePromotion', () => {
  it('replays only buy-ins and hours played', () => {
    const checkIn = draft({ trigger: 'check_in', conditions: {}, effect: { kind: 'cab_eligibility' } });
    expect(simulatePromotion(checkIn, [])).toEqual({ ok: false, error: 'not_replayable' });
  });

  it('does not replay a rule that asks about past visits, call time or a hand', () => {
    const lapsed = draft({ trigger: 'buy_in', conditions: { lapsed_days: 30 }, effect: BONUS });
    expect(simulatePromotion(lapsed, [])).toEqual({ ok: false, error: 'not_replayable' });
    const tiered = draft({ trigger: 'buy_in', conditions: { tier_ids: ['black'], min_hours: 2 }, effect: BONUS });
    expect(simulatePromotion(tiered, []).ok).toBe(true);
  });

  it('takes an hours-played window as met by the replay, at any stake, as the engine does', () => {
    const windowed = draft({ trigger: 'hours_played', conditions: { days: [4], from: '14:00', until: '20:00', stakes: ['nlh_100_200'] }, effect: DOUBLE_POINTS });
    const closedLater = eventAt('2026-11-20T09:00:00+05:30', { stake: 'nlh_25_50', points: 50n, hoursPlayed: 2 });
    const result = simulatePromotion(windowed, [closedLater]);
    expect(result.ok && result.value.points).toBe(50n);
  });

  it('weighs an hours-played rule without a window at its stake', () => {
    const atStake = draft({ trigger: 'hours_played', conditions: { stakes: ['nlh_100_200'] }, effect: DOUBLE_POINTS });
    const elsewhere = eventAt('2026-11-17T23:00:00+05:30', { stake: 'nlh_25_50', points: 50n, hoursPlayed: 2 });
    const result = simulatePromotion(atStake, [elsewhere]);
    expect(result.ok && result.value.grants).toBe(0);
  });

  it('counts the first N at each table apart, and not after N', () => {
    const firstAtTable = draft({ trigger: 'buy_in', conditions: { first_n: { count: 1, per: 'table' } }, effect: BONUS });
    const buyIn = (at: string, memberId: string, tableId: string) => eventAt(at, { memberId, tableId, amount: fromPaise(1_000_000n) });
    const result = simulatePromotion(firstAtTable, [
      buyIn('2026-11-17T20:00:00+05:30', 'arjun', 't1'), buyIn('2026-11-17T20:05:00+05:30', 'kabir', 't1'),
      buyIn('2026-11-17T20:10:00+05:30', 'naina', 't3'),
    ]);
    expect(result.ok && result.value.grants).toBe(2);
    expect(result.ok && result.value.isBudgetReached).toBe(false);
  });

  it('holds hours played to a minimum when the rule asks for one', () => {
    const longPlay = draft({ trigger: 'hours_played', conditions: { min_hours: 4 }, effect: DOUBLE_POINTS });
    const result = simulatePromotion(longPlay, [
      eventAt('2026-11-17T23:00:00+05:30', { points: 30n, hoursPlayed: 3 }),
      eventAt('2026-11-18T01:00:00+05:30', { memberId: 'kabir', points: 40n, hoursPlayed: 4 }),
    ]);
    expect(result.ok && { grants: result.value.grants, points: result.value.points }).toEqual({ grants: 1, points: 40n });
  });
});
