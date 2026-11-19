// The owner's alerts by WhatsApp (#100; decision 0191): each alert.raised sends the alert's kind in words to
// the WhatsApp number in venue configuration, through the Evolution bridge for now (decision 0297). pg_cron runs it every minute
// (decision 0038). A messaging stop does not hold it (#468); practice-venue events never reach it; only alerts raised within the day send. The number is read
// from the database at send time and never logged.
import { createAlertConsumer, type FindAlertNumber } from '@rivr/adapters/messages';
import { indianMobileSchema } from '@rivr/contracts';
import { z } from 'zod';
import { rpc, serveConsumer } from '../_shared/outbox.ts';
import { fenced, isWhatsAppOff, liveWhatsApp, whatsAppOff } from '../_shared/whatsapp.ts';

const numberRows = z.array(z.object({ alert_whatsapp: z.string().nullable() }));

/** The venue's alert number for an alert raised within the day, through the service role only; 'no_number' with none set; null for any other alert. */
const findAlertNumber: FindAlertNumber = async (venueId, alertId) => {
  const row = numberRows.parse(await rpc('alert_recipient', { p_venue_id: venueId, p_alert_id: alertId }))[0];
  if (row === undefined) return null;
  const phone = indianMobileSchema.safeParse(row.alert_whatsapp);
  return phone.success ? phone.data : 'no_number';
};

// Switched off (WHATSAPP_OFF=true), as on production, each alert is taken and none is sent by WhatsApp: alerts stay on the
// dashboard and go by email (alert-email). With no secrets and not switched off, nothing is claimed and alerts wait.
const whatsapp = liveWhatsApp(10_000);
Deno.serve(
  whatsapp || isWhatsAppOff()
    ? serveConsumer(createAlertConsumer({ whatsapp: whatsapp ? fenced(whatsapp) : whatsAppOff, findAlertNumber }))
    : () => Response.json({ error: 'WhatsApp is not configured' }, { status: 503 }),
);
