// The CRM sync (#647): each member is a contact in the club's HubSpot, upserted after they sign up, save their sign-up
// answers, finish the identity check or end a visit. Filtering, sorting and the full record live in HubSpot, never in
// the console. pg_cron runs it every minute (decision 0038); practice-venue events never reach it. Each run first
// queues any member not yet synced, so every member arrives, not only recent ones. Until HUBSPOT_ACCESS_TOKEN is set
// nothing is queued or claimed.
import { runConsumer } from '@rivr/adapters';
import { createCrmConsumer, createHubSpotCrm, crmContactFrom, type FindCrmContact } from '@rivr/adapters/crm';
import { outboxStore, rpc, serveScheduled } from '../_shared/outbox.ts';

const accessToken = Deno.env.get('HUBSPOT_ACCESS_TOKEN') ?? '';

const find: FindCrmContact = async (venueId, payload) => crmContactFrom(await rpc('crm_contact', { p_venue_id: venueId, p_payload: payload }));

const consumer = createCrmConsumer({ find, crm: createHubSpotCrm({ accessToken }) });

Deno.serve(
  accessToken
    ? serveScheduled(async () => {
        await rpc('queue_crm_sync', {});
        return runConsumer(outboxStore, consumer);
      })
    : () => Response.json({ error: 'The CRM is not configured' }, { status: 503 }),
);
