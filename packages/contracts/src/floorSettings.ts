/**
 * The Live floor's own settings (console v3) under Settings, Floor, and the TVs' under Settings, TVs: the boards shown, the
 * time on each, and the hours leaderboard. Part of SETTINGS in settings.ts, kept here to hold that file to its size.
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

/** Which boards the TVs show (redesign RD-28): one switched off is left out on every TV. None set is every board. */
export const tvBoards = {
  key: 'tv.boards',
  defaultValue: { waitlist: true, call_time: true, promotions: true, leaderboard: true, high_hand: true },
  description: 'The boards the TVs show: a board switched off is left out on every TV. None set is every board.',
  scope: 'venue',
  value: z.strictObject({ waitlist: z.boolean(), call_time: z.boolean(), promotions: z.boolean(), leaderboard: z.boolean(), high_hand: z.boolean() }),
} as const satisfies SettingDefinition;

// A board's turn on a TV: five seconds to ten minutes.
const boardSeconds = z.int().min(5).max(600);

/** The seconds each board shows on a TV before the next (redesign RD-28); a promotion, each slide. None set is 30, and 12 a promotion. */
export const tvBoardSeconds = {
  key: 'tv.board_seconds',
  defaultValue: { waitlist_seconds: 30, call_time_seconds: 30, promotions_seconds: 12, leaderboard_seconds: 30, high_hand_seconds: 30 },
  description: 'How long each board shows on a TV before the next, in seconds; a promotion, each slide. None set is 30 seconds, and 12 a promotion.',
  scope: 'venue',
  value: z.strictObject({
    waitlist_seconds: boardSeconds, call_time_seconds: boardSeconds, promotions_seconds: boardSeconds, leaderboard_seconds: boardSeconds,
    high_hand_seconds: boardSeconds,
  }),
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
