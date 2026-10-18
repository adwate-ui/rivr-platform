import { sha256Hex } from '../shared/hash.ts';
import type { MetaConversionEvent, MetaServerEvent } from './types.ts';

const MS_PER_SECOND = 1000;

/**
 * Builds the event Meta receives. Meta wants the phone as digits with the country code and no plus
 * (`919876543210`), the member id and the country, each SHA-256 hashed; nothing personal is sent in clear.
 */
export async function toMetaServerEvent(event: MetaConversionEvent): Promise<MetaServerEvent> {
  const [phone, memberId, country] = await Promise.all([
    sha256Hex(event.phone.replace('+', '')),
    sha256Hex(event.memberId),
    sha256Hex('in'),
  ]);
  return {
    event_name: event.eventName,
    event_time: Math.floor(event.eventTime.getTime() / MS_PER_SECOND),
    event_id: event.eventId,
    action_source: 'physical_store',
    user_data: { ph: [phone], external_id: [memberId], country: [country] },
  };
}
