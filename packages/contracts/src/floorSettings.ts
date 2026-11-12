/**
 * The Live floor's own settings (console v3), and the TVs' hours leaderboard, both under Settings, Floor. Part of SETTINGS in
 * settings.ts, kept here to hold that file to its size.
 */
import { z } from 'zod';
import { TV_LEADERBOARD_PERIODS } from './devices.ts';
import type { SettingDefinition } from './settingDefinition.ts';

/** How long a request may wait on the Live floor before it shows late, in seconds (decision 0479); unset, @rivr/domain's defaults. */
export const floorRequestTargets = {
  key: 'floor.request_targets',
  defaultValue: { top_up_seconds: 180, other_seconds: 300 },
  description: 'How long a request may wait on the Live floor before it shows late: a top-up, and every other request, in seconds.',
  scope: 'venue',
  value: z.strictObject({ top_up_seconds: z.int().min(30).max(1800), other_seconds: z.int().min(60).max(3600) }),
} as const satisfies SettingDefinition;

/**
 * The TVs' hours leaderboard (the owner, 12 Nov; decision 0581): the period it counts, and the top N members, those past a
 * number of hours, or the top N of those. None set is tonight's top 10. Twelve fill the board's two columns.
 */
export const tvLeaderboard = {
  key: 'tv.leaderboard',
  description: 'The TVs\' hours leaderboard: the period it counts, and the top N members, those past a number of hours, or both. None set is tonight\'s top 10.',
  scope: 'venue',
  value: z.strictObject({
    period: z.enum(TV_LEADERBOARD_PERIODS),
    top: z.int().min(1).max(12).optional(),
    min_hours: z.int().min(1).max(500).optional(),
  }),
} as const satisfies SettingDefinition;
