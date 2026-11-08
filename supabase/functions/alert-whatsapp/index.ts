// The owner's alerts by WhatsApp (#100; decision 0191): each alert.raised sends the alert's kind in words to
// the WhatsApp number in venue configuration, through the Evolution bridge for now (decision 0297). pg_cron runs it every minute
// (decision 0038). A messaging stop does not hold it (#468); practice-venue events never reach it; only alerts raised within the day send. The number is read
// from the database at send time and never logged.
import { createAlertConsumer, type FindAlertNumber } from '@rivr/adapters/messages';
import { indianMobileSchema } from '@rivr/contracts';
import { z } from 'zod';
import { rpc, serveConsumer } from '../_shared/outbox.ts';
import { fenced, liveWhatsApp } from '../_shared/whatsapp.ts';

const numberRows = z.array(z.object({ alert_whatsapp: z.string().nullable() }));

/** The venue's alert number for an alert raised within the day, through the service role only; 'no_number' with none set; null for any other alert. */
const findAlertNumber: FindAlertNumber = async (venueId, alertId) => {
  const row = numberRows.parse(await rpc('alert_recipient', { p_venue_id: venueId, p_alert_id: alertId }))[0];
  if (row === undefined) return null;
  const phone = indianMobileSchema.safeParse(row.alert_whatsapp);
  return phone.success ? phone.data : 'no_number';
};

// Until WhatsApp is approved and its credentials set, nothing is claimed: alerts wait on the dashboard.
const whatsapp = liveWhatsApp(10_000);
Deno.serve(
  whatsapp
    ? serveConsumer(createAlertConsumer({ whatsapp: fenced(whatsapp), findAlertNumber }))
    : () => Response.json({ error: 'WhatsApp is not configured' }, { status: 503 }),
);
