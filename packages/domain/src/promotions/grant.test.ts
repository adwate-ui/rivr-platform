import type { Reward } from '@rivr/contracts/promotionModel';
import { buildPromotionEvent } from '@rivr/testing';
import { describe, expect, it } from 'vitest';
import { computeGrant, toPromotionEvent, triggerOf, type PromotionEvent } from './grant.ts';

const event = (...args: Parameters<typeof buildPromotionEvent>): PromotionEvent => toPromotionEvent(buildPromotionEvent(...args));
const seat = event({ kind: 'seated', isFirstOfVisit: true });
const played = event({ kind: 'time_played', minutes: 300 });
// A play-time bonus step: 300 minutes played, the 240-minute step reached.
const step = (stepMinutes: number, minutes = 300) => event({ kind: 'hours_step', minutes, stepMinutes }, { key: `hours_step:visit-1:${String(stepMinutes)}` });
const visit = event({ kind: 'visit', visitInMonth: 5 }, { tableId: null, stake: null });
const grantOf = (reward: Reward, on: PromotionEvent) => computeGrant({ reward }, on);

describe('toPromotionEvent', () => {
  it('reads the moment as a date and keeps the rest', () => {
    expect(seat.at.toISOString()).toBe('2026-11-17T15:30:00.000Z');
    expect(seat.kind === 'seated' && seat.isFirstOfVisit).toBe(true);
  });
});

describe('triggerOf', () => {
  it('gives play-time bonuses for each step, seat bonuses for a seat and perks for visits', () => {
    expect(triggerOf({ kind: 'hours_bonus', chips: 1_000, afterMinutes: 240 })).toBe('hours_step');
    expect(triggerOf({ kind: 'seat_bonus', chips: 1_000 })).toBe('seated');
    expect(triggerOf({ kind: 'hours_bonus', mode: 'every', everyMinutes: 60, chips: 100 })).toBe('hours_step');
    expect(triggerOf({ kind: 'cab_home', fromVisitInMonth: 4 })).toBe('visit');
    expect(triggerOf({ kind: 'tournament_entry', tournamentId: 'RIVR Sunday' })).toBe('visit');
    expect(triggerOf({ kind: 'waitlist_priority' })).toBe('visit');
  });

  it('gives bonus chips for the event they are on', () => {
    expect(triggerOf({ kind: 'bonus_chips', chips: 500, on: 'visit' })).toBe('visit');
    expect(triggerOf({ kind: 'bonus_chips', chips: 500, on: 'referral' })).toBe('referral');
    expect(triggerOf({ kind: 'bonus_chips', chips: 500, on: 'signup' })).toBe('signup');
  });
});

describe('computeGrant', () => {
  it('gives a seat bonus on a seat, and nothing on a seat for a reward of another event', () => {
    expect(grantOf({ kind: 'seat_bonus', chips: 1_000 }, seat)).toEqual({ ok: true, value: { chips: 1_000, perk: null } });
    expect(grantOf({ kind: 'hours_bonus', chips: 1_000, afterMinutes: 240 }, seat)).toEqual({ ok: false, error: 'other_event' });
    expect(grantOf({ kind: 'bonus_chips', chips: 1_000, on: 'visit' }, seat)).toEqual({ ok: false, error: 'other_event' });
  });

  it('gives nothing for time played or a visit for a reward of another event', () => {
    expect(grantOf({ kind: 'cab_home', fromVisitInMonth: 1 }, played)).toEqual({ ok: false, error: 'other_event' });
    expect(grantOf({ kind: 'seat_bonus', chips: 500 }, visit)).toEqual({ ok: false, error: 'other_event' });
  });

  it('gives a cab from its visit on, the visit itself included', () => {
    expect(grantOf({ kind: 'cab_home', fromVisitInMonth: 5 }, visit)).toEqual({ ok: true, value: { chips: 0, perk: 'cab_home' } });
    expect(grantOf({ kind: 'cab_home', fromVisitInMonth: 6 }, visit)).toEqual({ ok: false, error: 'not_yet' });
  });

  it('gives a play-time bonus only for its own step, never for time played alone', () => {
    expect(grantOf({ kind: 'hours_bonus', chips: 500, afterMinutes: 240 }, played)).toEqual({ ok: false, error: 'other_event' });
  });

  it('gives a play-time bonus step its own chips once its minutes are played, and nothing for a step it does not have (owner, 8 Nov)', () => {
    const chipsOf = (chips: number) => ({ ok: true, value: { chips, perk: null } });
    expect(grantOf({ kind: 'hours_bonus', chips: 500, afterMinutes: 240 }, step(240))).toEqual(chipsOf(500));
    expect(grantOf({ kind: 'hours_bonus', chips: 500, afterMinutes: 330 }, step(330))).toEqual({ ok: false, error: 'too_short' });
    expect(grantOf({ kind: 'hours_bonus', chips: 500, afterMinutes: 240 }, step(120))).toEqual({ ok: false, error: 'not_a_step' });
    const steps: Reward = { kind: 'hours_bonus', mode: 'steps', steps: [{ afterMinutes: 120, chips: 500 }, { afterMinutes: 240, chips: 1_000 }] };
    expect(grantOf(steps, step(120))).toEqual(chipsOf(500));
    expect(grantOf(steps, step(240))).toEqual(chipsOf(1_000));
    expect(grantOf(steps, step(180))).toEqual({ ok: false, error: 'not_a_step' });
    const every: Reward = { kind: 'hours_bonus', mode: 'every', everyMinutes: 90, chips: 250, timesPerVisit: 2 };
    expect(grantOf(every, step(180))).toEqual(chipsOf(250));
    expect(grantOf(every, step(270))).toEqual({ ok: false, error: 'not_a_step' });
  });

  it('gives bonus chips for a referral only on a referral', () => {
    const referral = event({ kind: 'referral' });
    expect(grantOf({ kind: 'bonus_chips', chips: 1_000, on: 'referral' }, referral).ok).toBe(true);
    expect(grantOf({ kind: 'bonus_chips', chips: 1_000, on: 'signup' }, referral)).toEqual({ ok: false, error: 'other_event' });
    expect(grantOf({ kind: 'waitlist_priority' }, referral)).toEqual({ ok: false, error: 'other_event' });
  });
});
