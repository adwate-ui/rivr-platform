import { alertRaisedSchema, err, ok, type IndianMobile } from '@rivr/contracts';
import { alerts } from '@rivr/i18n';
import type { Consumer } from '../outbox/index.ts';
import type { AdapterFailure } from '../shared/failure.ts';
import type { WhatsAppAdapter } from '../whatsapp/types.ts';

/**
 * The venue's alert number from venue configuration for an alert raised there within the day; null when it
 * has none, for the practice venue, or for an older alert, which is then not sent.
 */
export type FindAlertNumber = (venueId: string, alertId: string) => Promise<IndianMobile | null>;

/** The events the alert consumer sends a message for. */
export const ALERT_EVENT_TYPES = ['alert.raised'] as const;

/** An alert's kind in words, as the owner's message says it: never its details. */
function kindInWords(kind: string): string {
  const words = Object.entries(alerts.kinds).find(([known]) => known === kind)?.[1];
  return words ?? alerts.other;
}

/**
 * The owner's alerts by WhatsApp (#100; additions "Alerting"): each alert.raised sends the alert's kind in
 * words to the WhatsApp number in venue configuration, and nothing else, so no personal data leaves in
 * it; the details are on the owner dashboard. Not a messaging consumer (the owner's answer on #468): a
 * messaging stop holds messages to members, but the owner's alerts still reach the alert number, so the owner
 * hears about the stop itself. A venue with no alert number, or an alert raised more than a day ago, sends
 * nothing, and nothing is wrong.
 */
export function createAlertConsumer({ whatsapp, findAlertNumber }: { whatsapp: WhatsAppAdapter; findAlertNumber: FindAlertNumber }): Consumer {
  return {
    name: 'alert_whatsapp',
    eventTypes: ALERT_EVENT_TYPES,
    isMessaging: false,
    async deliver(delivery) {
      const raised = alertRaisedSchema.safeParse(delivery.payload);
      if (!raised.success) return err<AdapterFailure>({ code: 'rejected', reason: 'alert.raised payload is not an alert' });
      const to = await findAlertNumber(delivery.venueId, raised.data.alert_id);
      if (to === null) return ok(null);
      return whatsapp.sendTemplate({ category: 'utility', to, template: 'owner_alert', params: [kindInWords(raised.data.kind)] });
    },
  };
}
