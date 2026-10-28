import { z } from 'zod';

/**
 * The club's VAPID public key (#139; decision 0272): the player app subscribes a phone with it, and the push consumer
 * signs with its private key, a function secret the owner sets on staging and production. Public by design.
 */
export const WEB_PUSH_PUBLIC_KEY = 'BFOfOzf0MsiiMePmtSJ7T88eGysxws9ybpCwRoXdX-UGJGY56G0odTA6cOF33LPyHdHITD7hxL_uAdE1e_LOYV8';

/** The browsers' own push services (Chrome's, Firefox's, Apple's, Windows'): a subscription anywhere else is refused. */
export const PUSH_SERVICE_ADDRESS = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)\/\S+$/;

/** A browser's push subscription as the player app saves it: its push service's address and its keys, base64url. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().max(2000).regex(PUSH_SERVICE_ADDRESS),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{20,200}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),
  }),
});

/** A push subscription to save. */
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
