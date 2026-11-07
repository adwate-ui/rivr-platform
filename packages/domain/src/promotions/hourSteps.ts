import type { Reward } from '@rivr/contracts/promotionModel';

/** A play-time bonus (owner, 8 Nov): once after a time, at set steps, or every so often. */
export type HoursBonus = Extract<Reward, { kind: 'hours_bonus' }>;

/** One step of a play-time bonus: the minutes played it is reached at, and the bonus chips it pays. */
export interface HourStep {
  readonly afterMinutes: number;
  readonly chips: number;
}

// Every so often stops at a day's play: no step is past 24 hours.
const DAY_MINUTES = 1_440;

/**
 * A play-time bonus's steps, earliest first (owner, 8 Nov): the plain form's one step; the set steps; or one every so
 * many minutes, as many times a visit as it allows and never past 24 hours. The database's private.promo_hours_steps is
 * proved equal on promotionRewards.json.
 */
export function hourSteps(reward: HoursBonus): readonly HourStep[] {
  if (!('mode' in reward)) return [{ afterMinutes: reward.afterMinutes, chips: reward.chips }];
  if (reward.mode === 'steps') return reward.steps;
  const times = Math.min(reward.timesPerVisit ?? DAY_MINUTES, Math.floor(DAY_MINUTES / reward.everyMinutes));
  return Array.from({ length: times }, (_, at) => ({ afterMinutes: (at + 1) * reward.everyMinutes, chips: reward.chips }));
}

/** The minutes of each step that `minutes` played has reached, earliest first. */
export function stepsReached(reward: HoursBonus, minutes: number): readonly number[] {
  return hourSteps(reward).filter((step) => step.afterMinutes <= minutes).map((step) => step.afterMinutes);
}
