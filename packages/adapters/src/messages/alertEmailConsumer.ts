import { alertRaisedSchema, err, ok } from '@rivr/contracts';
import { alerts } from '@rivr/i18n';
import type { EmailAdapter } from '../email/types.ts';
import type { Consumer } from '../outbox/index.ts';
import type { AdapterFailure } from '../shared/failure.ts';
import { ALERT_EVENT_TYPES, kindInWords } from './alertConsumer.ts';

/**
 * The venue's alert email addresses for an alert raised there within the day while email alerts are on; null when they
 * are off, for the practice venue or for an older alert, which is then not sent.
 */
export type FindAlertEmails = (venueId: string, alertId: string) => Promise<readonly string[] | null>;

/** The alert's words as a sentence: `Sign-in codes are being refused…`. */
const sentence = (words: string) => `${words.charAt(0).toUpperCase()}${words.slice(1)}`;

/**
 * The super admins' alerts by email too (#1066, the owner, 17 Nov): each alert.raised that goes to the alert WhatsApp
 * number also goes to the venue's alert addresses while email alerts are on, with the alert's kind in words and nothing
 * else, so no member's details leave in it; the details are in the console. Not held by a messaging stop, as WhatsApp's
 * alerts are not (#468). An alert raised more than a day ago sends nothing.
 */
export function createAlertEmailConsumer({ email, findAlertEmails }: { email: EmailAdapter; findAlertEmails: FindAlertEmails }): Consumer {
  return {
    name: 'alert_email',
    eventTypes: ALERT_EVENT_TYPES,
    isMessaging: false,
    async deliver(delivery) {
      const raised = alertRaisedSchema.safeParse(delivery.payload);
      if (!raised.success) return err<AdapterFailure>({ code: 'rejected', reason: 'alert.raised payload is not an alert' });
      const to = await findAlertEmails(delivery.venueId, raised.data.alert_id);
      if (to === null) return ok(null);
      const words = kindInWords(raised.data.kind);
      return email.send({ to, subject: alerts.email.subject.replace('{kind}', words), text: alerts.email.body.replace('{kind}', sentence(words)) });
    },
  };
}
