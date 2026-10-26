// The owner's alerts by WhatsApp (#100; decision 0191): each alert.raised sends the alert's kind in words to
// the WhatsApp number in venue configuration, through Meta's Cloud API. pg_cron runs it every minute
// (decision 0038). A messaging stop does not hold it (#468); practice-venue events never reach it; only alerts raised within the day send. The number is read
// from the database at send time and never logged.
import { createWhatsAppCloudApi } from '@rivr/adapters/whatsapp';
import { createAlertConsumer, type FindAlertNumber } from '@rivr/adapters/messages';
import { indianMobileSchema } from '@rivr/contracts';
import { z } from 'zod';
import { rpc, serveConsumer } from '../_shared/outbox.ts';

const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '';
const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? '';

const numberRows = z.array(z.object({ alert_whatsapp: z.string().nullable() }));

/** The venue's alert number for an alert raised within the day, through the service role only; null otherwise. */
const findAlertNumber: FindAlertNumber = async (venueId, alertId) => {
  const row = numberRows.parse(await rpc('alert_recipient', { p_venue_id: venueId, p_alert_id: alertId }))[0];
  const phone = indianMobileSchema.safeParse(row?.alert_whatsapp);
  return phone.success ? phone.data : null;
};

// Until WhatsApp is approved and its credentials set, nothing is claimed: alerts wait on the dashboard.
Deno.serve(
  phoneNumberId && accessToken
    ? serveConsumer(createAlertConsumer({ whatsapp: createWhatsAppCloudApi({ phoneNumberId, accessToken, timeoutMs: 10_000 }), findAlertNumber }))
    : () => Response.json({ error: 'WhatsApp is not configured' }, { status: 503 }),
);
