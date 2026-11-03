import { z } from 'zod';

/** The phones the lock-screen live status reaches (decision 0323): an iPhone's Live Activity, an Android phone's ongoing notification. */
export const LIVE_STATUS_PLATFORMS = ['ios', 'android'] as const;

/** An iPhone or an Android phone. */
export type LiveStatusPlatform = (typeof LIVE_STATUS_PLATFORMS)[number];

/** An Apple push token: a push-to-start token or a Live Activity's own, in hex. */
const appleTokenSchema = z.string().regex(/^[0-9a-f]{64,200}$/);

/**
 * A phone as the native app saves it (decision 0361): its platform and its push token, as the database takes them. An
 * iPhone's is ActivityKit's push-to-start token; an Android phone's is its Firebase registration token.
 */
export const liveStatusDeviceSchema = z.discriminatedUnion('platform', [
  z.object({ platform: z.literal('ios'), token: appleTokenSchema }),
  z.object({ platform: z.literal('android'), token: z.string().min(20).max(4096).regex(/^[A-Za-z0-9_:-]+$/) }),
]);

/** A phone to save. */
export type LiveStatusDeviceInput = z.infer<typeof liveStatusDeviceSchema>;

/**
 * What an iPhone reports with its own key alone, through the live-status-token function (decision 0361): a new
 * push-to-start token, or the token of a Live Activity started by push, while the app's web view is not running.
 */
export const liveStatusTokenReportSchema = z
  .object({
    device_key: z.string().regex(/^[0-9a-f]{64}$/),
    push_token: appleTokenSchema.optional(),
    activity_push_token: appleTokenSchema.optional(),
  })
  .refine((report) => report.push_token !== undefined || report.activity_push_token !== undefined, { message: 'a token to report' });

/**
 * waitlist.moved (decision 0360): a place on a list joined, was approved, sat or left, so the places behind it may have
 * moved. The lock-screen consumer refreshes everyone waiting on that list.
 */
export const waitlistMovedSchema = z.object({ entry_id: z.uuid(), member_id: z.uuid(), table_type_id: z.uuid() });
