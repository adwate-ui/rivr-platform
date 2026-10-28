// The Google Ads offline conversions consumer (#162; decision 0279), enabled and not behind a flag: the same conversions as
// Meta's, each uploaded under its kind's conversion action with the phone hashed. pg_cron runs it every minute (decision
// 0038); practice-venue events never reach it. Until the GOOGLE_ADS_* secrets are set, with a conversion action for every
// kind, nothing is claimed, and conversions wait.
import {
  conversionActionsSchema, conversionSubjectFrom, createConversionConsumer, reportToGoogle, type ConversionActions, type FindConversion,
} from '@rivr/adapters/conversions';
import { createGoogleAdsConversions } from '@rivr/adapters/google-ads';
import { rpc, serveConsumer } from '../_shared/outbox.ts';

const secret = (name: string) => Deno.env.get(name) ?? '';
const developerToken = secret('GOOGLE_ADS_DEVELOPER_TOKEN');
const clientId = secret('GOOGLE_ADS_CLIENT_ID');
const clientSecret = secret('GOOGLE_ADS_CLIENT_SECRET');
const refreshToken = secret('GOOGLE_ADS_REFRESH_TOKEN');
const customerId = secret('GOOGLE_ADS_CUSTOMER_ID');
const loginCustomerId = secret('GOOGLE_ADS_LOGIN_CUSTOMER_ID');

/** GOOGLE_ADS_CONVERSION_ACTIONS: a JSON object naming the conversion action for each kind, or null when it does not. */
function conversionActions(): ConversionActions | null {
  try {
    const parsed = conversionActionsSchema.safeParse(JSON.parse(secret('GOOGLE_ADS_CONVERSION_ACTIONS')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const actions = conversionActions();

const find: FindConversion = async (venueId, eventType, payload) =>
  conversionSubjectFrom(await rpc('conversion_for', { p_venue_id: venueId, p_event_type: eventType, p_payload: payload }));

Deno.serve(
  developerToken && clientId && clientSecret && refreshToken && customerId && actions
    ? serveConsumer(createConversionConsumer({
      name: 'google-ads',
      find,
      report: reportToGoogle(createGoogleAdsConversions({
        developerToken, clientId, clientSecret, refreshToken, customerId, ...(loginCustomerId ? { loginCustomerId } : {}),
      }), actions),
    }))
    : () => Response.json({ error: 'Google Ads is not configured' }, { status: 503 }),
);
