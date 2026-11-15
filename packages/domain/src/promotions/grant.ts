import type { PromotionEventJson, Reward } from '@rivr/contracts/promotionModel';
import { err, ok, type Result } from '@rivr/contracts/result';
import { highHandPayout, type HighHandRefusal } from './highHand.ts';
import { hourSteps } from './hourSteps.ts';

type WithMoment<E> = E extends unknown ? Omit<E, 'at'> & { readonly at: Date } : never;

/** An event a promotion weighs (`@rivr/contracts/promotionModel` promotionEventSchema), with its moment as a Date. */
export type PromotionEvent = WithMoment<PromotionEventJson>;
export type PromotionEventKind = PromotionEvent['kind'];

/** An event as the engine or the replay sends it, read for weighing. */
export function toPromotionEvent(json: PromotionEventJson): PromotionEvent {
  return { ...json, at: new Date(json.at) };
}

/** A perk the floor fulfils: a cab home, a tournament entry, first call on the waitlist. */
export type Perk = 'cab_home' | 'tournament_entry' | 'waitlist_priority';

/** What one promotion gives for one event: bonus chips or a perk, never paise; the other is 0 or null. */
export interface Grant {
  readonly chips: number;
  readonly perk: Perk | null;
}

export const NO_GRANT: Grant = { chips: 0, perk: null };

/**
 * Why a promotion gives nothing for an event: it is for another kind of event, nothing comes to anything, the time
 * played is short of its minutes, the step reached is not one of the play-time bonus's own, the visit is before its
 * number in the month, the seat is not the visit's first, or a high hand is not one it pays (HighHandRefusal).
 */
export type GrantRefusal = 'other_event' | 'too_short' | 'not_a_step' | 'not_yet' | 'not_first_seat' | HighHandRefusal;

type EventOf<K extends PromotionEventKind> = Extract<PromotionEvent, { kind: K }>;

const BONUS_CHIPS_EVENT: Readonly<Record<Extract<Reward, { kind: 'bonus_chips' }>['on'], PromotionEventKind>> = {
  visit: 'visit', referral: 'referral', signup: 'signup',
};

/** The kind of event a reward is given for: the engine weighs a version only for its own. */
export function triggerOf(reward: Reward): PromotionEventKind {
  switch (reward.kind) {
    case 'hours_bonus':
      return 'hours_step';
    case 'seat_bonus':
      return 'seated';
    case 'bonus_chips':
      return BONUS_CHIPS_EVENT[reward.on];
    case 'high_hand':
      return 'high_hand';
    default:
      return 'visit';
  }
}

const chipsGrant = (chips: number): Grant => ({ ...NO_GRANT, chips });

/**
 * A seat bonus (owner, 8 Nov): its chips on the first seat of a visit; with first N on any seat, and checkLimits counts them at
 * the table. In tiers (owner, 12 Nov; decision 0580) on the first seat of a visit, at the first tier's chips until
 * checkLimits sets the tier the claims so far fall in.
 */
function seatGrant(reward: Reward, event: EventOf<'seated'>): Result<Grant, GrantRefusal> {
  if (reward.kind !== 'seat_bonus') return err('other_event');
  if ('tiers' in reward) return event.isFirstOfVisit ? ok(chipsGrant(reward.tiers[0]?.chips ?? 0)) : err('not_first_seat');
  return reward.firstNSeatsPerTable === undefined && !event.isFirstOfVisit ? err('not_first_seat') : ok(chipsGrant(reward.chips));
}

/** A play-time bonus step reached (owner, 8 Nov): that step's chips, once its minutes are played. */
function stepGrant(reward: Reward, event: EventOf<'hours_step'>): Result<Grant, GrantRefusal> {
  if (reward.kind !== 'hours_bonus') return err('other_event');
  const step = hourSteps(reward).find((one) => one.afterMinutes === event.stepMinutes);
  if (step === undefined) return err('not_a_step');
  return event.minutes >= step.afterMinutes ? ok(chipsGrant(step.chips)) : err('too_short');
}

/** A high hand hit (redesign RD-22): its listed hand's Bonus, whole, every time. */
function highHandGrant(reward: Reward, event: EventOf<'high_hand'>): Result<Grant, GrantRefusal> {
  if (reward.kind !== 'high_hand') return err('other_event');
  const payout = highHandPayout(reward, event);
  return payout.ok ? ok(chipsGrant(payout.value.chips)) : payout;
}

function visitGrant(reward: Reward, event: EventOf<'visit'>): Result<Grant, GrantRefusal> {
  switch (reward.kind) {
    case 'bonus_chips':
      return reward.on === 'visit' ? ok(chipsGrant(reward.chips)) : err('other_event');
    case 'cab_home':
      return event.visitInMonth >= reward.fromVisitInMonth ? ok({ ...NO_GRANT, perk: 'cab_home' }) : err('not_yet');
    case 'tournament_entry':
    case 'waitlist_priority':
      return ok({ ...NO_GRANT, perk: reward.kind });
    default:
      return err('other_event');
  }
}

/**
 * What a promotion's reward gives for one event (decision 0472), before its limits: chips or a perk, never paise. A
 * seat bonus's chips on a seat; a play-time bonus step's chips as each step is reached (owner, 8 Nov);
 * bonus chips on their event; a cab home from the visit's
 * number in the month; an entry or waitlist priority on a visit. Time played gives nothing itself: a play-time bonus is
 * weighed as each of its steps is reached. A high hand pays its listed hand's Bonus (highHandPayout). The database's
 * private.promo_grant is proved equal on promotionRewards.json.
 */
export function computeGrant(promo: { readonly reward: Reward }, event: PromotionEvent): Result<Grant, GrantRefusal> {
  const { reward } = promo;
  switch (event.kind) {
    case 'seated':
      return seatGrant(reward, event);
    case 'time_played':
      return err('other_event');
    case 'hours_step':
      return stepGrant(reward, event);
    case 'visit':
      return visitGrant(reward, event);
    case 'high_hand':
      return highHandGrant(reward, event);
    default:
      return reward.kind === 'bonus_chips' && reward.on === event.kind ? ok(chipsGrant(reward.chips)) : err('other_event');
  }
}
