import type { Reward } from '@rivr/contracts/promotionModel';
import { buildPromotionEvent } from '@rivr/testing';
import { describe, expect, it } from 'vitest';
import { computeGrant, toPromotionEvent, triggerOf, type PromotionEvent } from './grant.ts';

const event = (...args: Parameters<typeof buildPromotionEvent>): PromotionEvent => toPromotionEvent(buildPromotionEvent(...args));
const buyIn = event({ kind: 'buy_in', ownChips: 10_000, isFirstOfVisit: true });
const played = event({ kind: 'time_played', minutes: 300, points: 200 });
const visit = event({ kind: 'visit', visitInMonth: 5 }, { tableId: null, stake: null });
const grantOf = (reward: Reward, on: PromotionEvent) => computeGrant({ reward }, on);

describe('toPromotionEvent', () => {
  it('reads the moment as a date and keeps the rest', () => {
    expect(buyIn.at.toISOString()).toBe('2026-11-17T15:30:00.000Z');
    expect(buyIn.kind === 'buy_in' && buyIn.ownChips).toBe(10_000);
  });
});

describe('triggerOf', () => {
  it('gives time-played rewards for time played, buy-in bonuses for buy-ins and perks for visits', () => {
    expect(triggerOf({ kind: 'points_multiplier', multiplier: 2 })).toBe('time_played');
    expect(triggerOf({ kind: 'hours_bonus', chips: 1_000, afterMinutes: 240 })).toBe('time_played');
    expect(triggerOf({ kind: 'free_spin', spins: 1, afterMinutes: 240 })).toBe('time_played');
    expect(triggerOf({ kind: 'buyin_bonus', mode: 'fixed', chips: 500 })).toBe('buy_in');
    expect(triggerOf({ kind: 'cab_home', fromVisitInMonth: 4 })).toBe('visit');
    expect(triggerOf({ kind: 'tournament_entry', tournamentId: 'RIVR Sunday' })).toBe('visit');
    expect(triggerOf({ kind: 'waitlist_priority' })).toBe('visit');
  });

  it('gives bonus chips for the event they are on', () => {
    expect(triggerOf({ kind: 'bonus_chips', chips: 500, on: 'visit' })).toBe('visit');
    expect(triggerOf({ kind: 'bonus_chips', chips: 500, on: 'first_buyin' })).toBe('buy_in');
    expect(triggerOf({ kind: 'bonus_chips', chips: 500, on: 'referral' })).toBe('referral');
    expect(triggerOf({ kind: 'bonus_chips', chips: 500, on: 'signup' })).toBe('signup');
  });
});

describe('computeGrant', () => {
  it('gives nothing on a buy-in for a reward of another event', () => {
    expect(grantOf({ kind: 'hours_bonus', chips: 1_000, afterMinutes: 240 }, buyIn)).toEqual({ ok: false, error: 'other_event' });
    expect(grantOf({ kind: 'bonus_chips', chips: 1_000, on: 'visit' }, buyIn)).toEqual({ ok: false, error: 'other_event' });
  });

  it('gives nothing for time played or a visit for a reward of another event', () => {
    expect(grantOf({ kind: 'cab_home', fromVisitInMonth: 1 }, played)).toEqual({ ok: false, error: 'other_event' });
    expect(grantOf({ kind: 'free_spin', spins: 1, afterMinutes: 30 }, visit)).toEqual({ ok: false, error: 'other_event' });
    expect(grantOf({ kind: 'buyin_bonus', mode: 'fixed', chips: 500 }, visit)).toEqual({ ok: false, error: 'other_event' });
  });

  it('gives a points multiplier only as points, and a cap only to a percent', () => {
    expect(grantOf({ kind: 'points_multiplier', multiplier: 1.75 }, played)).toEqual({ ok: true, value: { points: 150, chips: 0, spins: 0, perk: null } });
    expect(grantOf({ kind: 'buyin_bonus', mode: 'percent', percent: 100 }, buyIn)).toEqual({ ok: true, value: { points: 0, chips: 10_000, spins: 0, perk: null } });
  });

  it('gives a cab from its visit on, the visit itself included', () => {
    expect(grantOf({ kind: 'cab_home', fromVisitInMonth: 5 }, visit)).toEqual({ ok: true, value: { points: 0, chips: 0, spins: 0, perk: 'cab_home' } });
    expect(grantOf({ kind: 'cab_home', fromVisitInMonth: 6 }, visit)).toEqual({ ok: false, error: 'not_yet' });
  });

  it('gives spins once the minutes are played, the minute itself included', () => {
    expect(grantOf({ kind: 'free_spin', spins: 3, afterMinutes: 300 }, played)).toEqual({ ok: true, value: { points: 0, chips: 0, spins: 3, perk: null } });
    expect(grantOf({ kind: 'hours_bonus', chips: 500, afterMinutes: 330 }, played)).toEqual({ ok: false, error: 'too_short' });
  });

  it('gives bonus chips for a referral only on a referral', () => {
    const referral = event({ kind: 'referral' });
    expect(grantOf({ kind: 'bonus_chips', chips: 1_000, on: 'referral' }, referral).ok).toBe(true);
    expect(grantOf({ kind: 'bonus_chips', chips: 1_000, on: 'signup' }, referral)).toEqual({ ok: false, error: 'other_event' });
    expect(grantOf({ kind: 'waitlist_priority' }, referral)).toEqual({ ok: false, error: 'other_event' });
  });
});
