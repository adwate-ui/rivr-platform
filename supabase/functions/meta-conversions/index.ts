// The Meta Conversions API consumer (#161; decision 0279): each event the database names a conversion (an Academy
// booking, KYC complete, a first visit, a first buy-in, a tournament entry, a repeat visit) goes to the club's dataset
// from a physical store, with hashed identifiers, for members who consented to marketing, within seven days. pg_cron runs
// it every minute (decision 0038); practice-venue events never reach it. Until META_PIXEL_ID and META_CAPI_ACCESS_TOKEN
// are set nothing is claimed, and conversions wait.
import { conversionSubjectFrom, createConversionConsumer, reportToMeta, type FindConversion } from '@rivr/adapters/conversions';
import { createMetaConversionsApi } from '@rivr/adapters/meta-conversions';
import { rpc, serveConsumer } from '../_shared/outbox.ts';

const pixelId = Deno.env.get('META_PIXEL_ID') ?? '';
const accessToken = Deno.env.get('META_CAPI_ACCESS_TOKEN') ?? '';

const find: FindConversion = async (venueId, eventType, payload) =>
  conversionSubjectFrom(await rpc('conversion_for', { p_venue_id: venueId, p_event_type: eventType, p_payload: payload }));

Deno.serve(
  pixelId && accessToken
    ? serveConsumer(createConversionConsumer({ name: 'meta-conversions', find, report: reportToMeta(createMetaConversionsApi({ pixelId, accessToken })) }))
    : () => Response.json({ error: 'The Meta Conversions API is not configured' }, { status: 503 }),
);
