// The super admins' alerts by email too (#1066): each alert.raised that goes to the alert WhatsApp number also goes, with
// its kind in words, to the venue's alert addresses while email alerts are on, through Resend. pg_cron runs it every
// minute once its secrets are set (docs/runbooks/ci-and-release.md); until then it answers 503 and claims nothing. A
// messaging stop does not hold it; practice-venue events never reach it; only alerts raised within the day send. The
// addresses are read from the database at send time and never logged; staging sends only to EMAIL_ALLOWLIST.
import { createAlertEmailConsumer, type FindAlertEmails } from '@rivr/adapters/messages';
import { createResendEmail, fencedEmail } from '@rivr/adapters/email';
import { z } from 'zod';
import { rpc, serveConsumer } from '../_shared/outbox.ts';

const addressRows = z.array(z.object({ alert_emails: z.array(z.string()) }));

/** The venue's alert addresses for an alert raised within the day while email alerts are on, through the service role only; null otherwise. */
const findAlertEmails: FindAlertEmails = async (venueId, alertId) => {
  const row = addressRows.parse(await rpc('alert_email_recipients', { p_venue_id: venueId, p_alert_id: alertId }))[0];
  return row === undefined || row.alert_emails.length === 0 ? null : row.alert_emails;
};

const secret = (name: string): string => Deno.env.get(name) ?? '';
const [apiKey, from] = [secret('RESEND_API_KEY'), secret('ALERT_EMAIL_FROM')];

// Until Resend's key and the From address are set, nothing is claimed: alerts still reach WhatsApp and the dashboard.
Deno.serve(
  apiKey && from
    ? serveConsumer(createAlertEmailConsumer({ email: fencedEmail(createResendEmail({ apiKey, from }), secret('EMAIL_ALLOWLIST')), findAlertEmails }))
    : () => Response.json({ error: 'Email is not configured' }, { status: 503 }),
);
