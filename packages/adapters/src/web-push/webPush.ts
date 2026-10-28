import { err, ok } from '@rivr/contracts';
import webpush from 'web-push';
import type { PushAdapter, PushFailure } from '../push/types.ts';

/** The club's VAPID keys and who runs the sender, for web push (#139; decision 0272). */
export interface WebPushOptions {
  readonly publicKey: string;
  readonly privateKey: string;
  /** Where push services contact the sender: an https address or `mailto:`. */
  readonly subject: string;
  /** For tests; web-push's own sender by default. */
  readonly sendNotification?: typeof webpush.sendNotification;
}

/** A push service's refusal, by its HTTP status: a browser that dropped the subscription, a limit, or a bad request. */
function failureOf(error: unknown): PushFailure {
  const status = error instanceof webpush.WebPushError ? error.statusCode : undefined;
  if (status === 404 || status === 410) return { code: 'subscription_gone' };
  if (status === 429) return { code: 'rate_limited' };
  if (status !== undefined && status >= 400 && status < 500) return { code: 'rejected', reason: `push service answered ${status}` };
  return { code: 'unavailable' };
}

/**
 * Web push through each browser's push service, signed with the club's VAPID key and encrypted for the browser
 * (RFC 8291, the web-push library). A notification keeps for an hour while the phone is offline; a push service gets three
 * seconds, so one slow phone cannot hold up the deliveries behind it.
 */
export function createWebPush({ publicKey, privateKey, subject, sendNotification = webpush.sendNotification }: WebPushOptions): PushAdapter {
  return {
    async send({ subscription, title, body, url, tag }) {
      try {
        const sent = await sendNotification(subscription, JSON.stringify({ title, body, url, tag }), {
          vapidDetails: { subject, publicKey, privateKey },
          TTL: 60 * 60,
          urgency: 'high',
          timeout: 3_000,
        });
        return ok({ id: sent.headers.location ?? '' });
      } catch (error) {
        return err(failureOf(error));
      }
    },
  };
}
