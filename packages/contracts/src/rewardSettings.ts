/**
 * The settings for what members earn by playing: points by the hour and from rake (RIVR Rewards), and hourly
 * rakeback. Part of SETTINGS in settings.ts, kept here to hold that file to its size.
 */
import { z } from 'zod';
import type { SettingDefinition } from './settingDefinition.ts';

export const pointsPerHour = {
  key: 'points.per_hour',
  description: 'Points a member earns for each hour played, per table type, so by stake (#89, decision 0161); none set earns none.',
  scope: 'table_type',
  value: z.strictObject({ points: z.int().min(0).max(10_000) }),
} as const satisfies SettingDefinition;

export const pointsRewardsRakeShare = {
  key: 'points.rewards_rake_share',
  description: 'RIVR Rewards (#89, decision 0161): the share of a member\'s rake, in basis points (500 is 5%), earned as points at one a rupee; none set earns none.',
  scope: 'venue',
  value: z.strictObject({ basis_points: z.int().min(0).max(10_000) }),
} as const satisfies SettingDefinition;

// A cap is in whole ₹50 chips.
export const rakebackRate = {
  key: 'rakeback.rate',
  description: 'Hourly rakeback (decision 0245): the share of a member\'s rake at this table type over a club week, in basis points (1000 is 10%), given as bonus each Monday at 06:00 IST, rounded down to whole ₹50 chips, held to the cap and ending after the days given. The rate in force when the week began applies to all of it; none set gives none. Only a super admin changes it, with a reason.',
  scope: 'table_type',
  value: z.strictObject({
    basis_points: z.int().min(1).max(10_000),
    cap_paise: z.int().min(5_000).max(10_000_000).multipleOf(5_000).optional(),
    expires_days: z.int().min(1).max(365),
  }),
} as const satisfies SettingDefinition;
