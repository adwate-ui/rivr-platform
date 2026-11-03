/**
 * The Live floor's own settings (console v3). Part of SETTINGS in settings.ts, kept here to hold that file to its size.
 */
import { z } from 'zod';
import type { SettingDefinition } from './settingDefinition.ts';

/** How long a request may wait on the Live floor before it shows late, in seconds (decision 0479); unset, @rivr/domain's defaults. */
export const floorRequestTargets = {
  key: 'floor.request_targets',
  description: 'How long a request may wait on the Live floor before it shows late: a top-up, and every other request, in seconds.',
  scope: 'venue',
  value: z.strictObject({ top_up_seconds: z.int().min(30).max(1800), other_seconds: z.int().min(60).max(3600) }),
} as const satisfies SettingDefinition;
