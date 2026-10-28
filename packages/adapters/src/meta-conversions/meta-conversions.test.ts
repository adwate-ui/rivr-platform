import { idempotencyKeySchema, indianMobileSchema, memberIdSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../shared/hash.ts';
import { createFakeMetaConversions, toMetaServerEvent, type MetaConversionEvent } from './index.ts';

const visit: MetaConversionEvent = {
  eventId: idempotencyKeySchema.parse('6a1f9c2e-3b4d-4e5f-8a6b-7c8d9e0f1a2b'),
  eventName: 'FirstVisit',
  eventTime: new Date('2026-11-16T18:40:00Z'),
  memberId: memberIdSchema.parse('3f2b8c4e-9d1a-4b6f-8e2c-7a5d9f0b1c3e'),
  phone: indianMobileSchema.parse('+919000000001'),
};

describe('Meta Conversions API event', () => {
  it('comes from a physical store, with the time in seconds and the event id for deduplication', async () => {
    const event = await toMetaServerEvent(visit);

    expect(event).toMatchObject({
      event_name: 'FirstVisit',
      event_time: 1_794_854_400,
      event_id: visit.eventId,
      action_source: 'physical_store',
    });
  });

  it('carries only hashed identifiers: phone as digits with the country code, member id, country', async () => {
    const event = await toMetaServerEvent(visit);

    expect(event.user_data).toEqual({
      ph: [await sha256Hex('919000000001')],
      external_id: [await sha256Hex(visit.memberId)],
      country: [await sha256Hex('in')],
    });
    expect(JSON.stringify(event)).not.toContain('9000000001"');
  });
});

describe('fake Meta Conversions API', () => {
  it('keeps only what Meta would receive, never the raw phone number', async () => {
    const meta = createFakeMetaConversions();

    expect(await meta.send(visit)).toEqual({ ok: true, value: { eventsReceived: 1 } });
    expect(meta.calls).toEqual([await toMetaServerEvent(visit)]);
    expect(JSON.stringify(meta.calls)).not.toContain('+919000000001');
  });

  it('fails the next send when a test scripts it', async () => {
    const meta = createFakeMetaConversions();
    meta.failNext({ code: 'unavailable' });

    expect(await meta.send(visit)).toEqual({ ok: false, error: { code: 'unavailable' } });
  });
});
