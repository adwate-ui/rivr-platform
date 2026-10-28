import { z } from 'zod';
import { promotionEffectSchema } from './promotions.ts';
import type { SettingDefinition } from './settingDefinition.ts';

/** Why a lapsed regular stopped coming, as the host records it (#165). */
export const HOST_CHURN_REASONS = ['moved_away', 'busy', 'budget', 'game_too_big', 'game_too_small', 'bad_experience', 'playing_elsewhere', 'unreachable', 'other'] as const;

/** A churn reason. */
export type HostChurnReason = (typeof HOST_CHURN_REASONS)[number];

/** How long a bonus offered from the host queue lasts, in days, as the promotion builder's do by default. */
export const HOST_OFFER_BONUS_DAYS = 30;

/** A host's call to a lapsed regular: why they stopped coming, the offer made as a promotion effect, and a note. */
export const hostContactSchema = z.strictObject({
  reason: z.enum(HOST_CHURN_REASONS),
  offer: promotionEffectSchema.nullable(),
  note: z.string().trim().min(1).max(500).nullable(),
});

/** A host's call to record. */
export type HostContact = z.infer<typeof hostContactSchema>;

/** When a regular has lapsed, for the host queue (#165): visits in the six months before, and days since the last. */
export const hostLapse = {
  key: 'host.lapse',
  description: 'When a regular has lapsed, for the host queue: at least this many visits in the six months before, and none for this many days; none set is 3 and 21.',
  scope: 'venue',
  value: z.strictObject({ visits: z.int().min(1).max(100), days: z.int().min(7).max(365) }),
} as const satisfies SettingDefinition;
