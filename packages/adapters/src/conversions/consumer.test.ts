import { describe, expect, it } from 'vitest';
import { createFakeGoogleAds } from '../google-ads/fake.ts';
import { createFakeMetaConversions } from '../meta-conversions/fake.ts';
import type { ClaimedDelivery } from '../outbox/index.ts';
import { sha256Hex } from '../shared/hash.ts';
import {
  CONVERSION_KINDS, conversionActionsSchema, conversionSubjectFrom, createConversionConsumer, reportToGoogle, reportToMeta, type FindConversion,
} from './index.ts';

const EVENT = '6a1f9c2e-3b4d-4e5f-8a6b-7c8d9e0f1a2b';
const MEMBER = '00000000-0000-4000-8000-000000000211';
const now = () => new Date('2026-11-16T18:40:00Z');
const hoursAgo = (hours: number) => new Date(now().getTime() - hours * 60 * 60 * 1000);

function delivery(eventType: string, occurredAt?: Date): ClaimedDelivery {
  return { deliveryId: 'd1', eventId: EVENT, venueId: 'v1', eventType, payload: { member_id: MEMBER }, attempts: 1, ...(occurredAt ? { occurredAt } : {}) };
}

/** The database's answer: a first visit for a visit, nothing for anything else. */
const find: FindConversion = async (_venueId, eventType) =>
  conversionSubjectFrom(eventType === 'visit.opened' ? [{ conversion: 'first_visit', member_id: MEMBER, phone: '+919000000211' }] : []);

const ACTIONS = conversionActionsSchema.parse(Object.fromEntries(CONVERSION_KINDS.map((kind, at) => [kind, `customers/1234567890/conversionActions/${at + 1}`])));

describe('the ad conversions consumer', () => {
  it('takes the five events that can be a conversion, and is not a messaging consumer', () => {
    const consumer = createConversionConsumer({ name: 'meta-conversions', find, report: reportToMeta(createFakeMetaConversions()), now });
    expect([consumer.name, consumer.isMessaging, consumer.eventTypes]).toEqual([
      'meta-conversions', false, ['academy.booked', 'kyc.completed', 'visit.opened', 'cage.buy_in', 'tournament.entered'],
    ]);
  });

  it('reports a first visit to Meta as FirstVisit, hashed, with the event id and time', async () => {
    const meta = createFakeMetaConversions();
    const consumer = createConversionConsumer({ name: 'meta-conversions', find, report: reportToMeta(meta), now });

    expect(await consumer.deliver(delivery('visit.opened', hoursAgo(1)))).toEqual({ ok: true, value: null });
    expect(meta.calls).toEqual([{
      event_name: 'FirstVisit', event_time: Math.floor(hoursAgo(1).getTime() / 1000), event_id: EVENT, action_source: 'physical_store',
      user_data: { ph: [await sha256Hex('919000000211')], external_id: [await sha256Hex(MEMBER)], country: [await sha256Hex('in')] },
    }]);
  });

  it('uploads it to Google Ads under its kind\u2019s conversion action', async () => {
    const google = createFakeGoogleAds();
    const consumer = createConversionConsumer({ name: 'google-ads', find, report: reportToGoogle(google, ACTIONS), now });

    await consumer.deliver(delivery('visit.opened', hoursAgo(1)));
    expect(google.calls.map((call) => [call.orderId, call.conversionAction, call.conversionDateTime])).toEqual([
      [EVENT, 'customers/1234567890/conversionActions/3', '2026-11-16 17:40:00+00:00'],
    ]);
  });

  it('finishes unsent an event that is not a conversion, or is older than seven days', async () => {
    const meta = createFakeMetaConversions();
    const consumer = createConversionConsumer({ name: 'meta-conversions', find, report: reportToMeta(meta), now });

    expect(await consumer.deliver(delivery('cage.buy_in', hoursAgo(1)))).toEqual({ ok: true, value: null });
    expect(await consumer.deliver(delivery('visit.opened', hoursAgo(8 * 24)))).toEqual({ ok: true, value: null });
    expect(meta.calls).toEqual([]);
  });

  it('passes on a vendor failure, to be tried again or given up', async () => {
    const meta = createFakeMetaConversions();
    meta.failNext({ code: 'unavailable' });
    const consumer = createConversionConsumer({ name: 'meta-conversions', find, report: reportToMeta(meta), now });
    expect(await consumer.deliver(delivery('visit.opened'))).toEqual({ ok: false, error: { code: 'unavailable' } });
    expect(await createConversionConsumer({ name: 'meta-conversions', find, report: reportToMeta(meta), now })
      .deliver({ ...delivery('visit.opened'), eventId: 'not-a-uuid' })).toEqual({ ok: false, error: { code: 'rejected', reason: 'the event id is not a UUID' } });
  });

  it('needs a conversion action for every kind', () => {
    expect(conversionActionsSchema.safeParse({ first_visit: 'customers/1/conversionActions/2' }).success).toBe(false);
    expect(conversionActionsSchema.safeParse({ ...ACTIONS, first_visit: 'conversion 2' }).success).toBe(false);
  });
});
