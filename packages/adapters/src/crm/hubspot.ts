import { err, ok } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import type { CrmAdapter, CrmContact } from './types.ts';

/** HubSpot's batch upsert of contacts, by a unique property of the club's own. */
const UPSERT_URL = 'https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert';

/** HubSpot's permanent delete of a contact, for a data subject's erasure, by the same property. */
const GDPR_DELETE_URL = 'https://api.hubapi.com/crm/v3/objects/contacts/gdpr-delete';

/**
 * The contact property, unique in the club's HubSpot portal, that holds the member's id. The owner creates it in HubSpot
 * (Settings, Properties) with the other `rivr_` properties below, before the token is set.
 */
export const HUBSPOT_ID_PROPERTY = 'rivr_member_id';

export interface HubSpotCrmOptions {
  /** A private app's access token, with the CRM contacts write scope. */
  readonly accessToken: string;
  /** For tests; the platform's fetch by default. */
  readonly fetch?: typeof globalThis.fetch;
  readonly timeoutMs?: number;
}

/** The contact as HubSpot's properties: its own for the name, phone and city, and the club's `rivr_` ones for the rest. */
export function toHubSpotProperties(contact: CrmContact): Record<string, string> {
  const [firstName = '', ...rest] = contact.fullName.split(' ');
  return {
    firstname: firstName,
    lastname: rest.join(' '),
    phone: contact.phone,
    city: contact.city ?? '',
    rivr_member_number: String(contact.memberNumber),
    rivr_occupation: contact.occupation ?? '',
    // HubSpot's multiple-checkbox properties take their values joined by semicolons.
    rivr_play_times: contact.playTimes.join(';'),
    rivr_games: contact.gamesPlayed.join(';'),
    rivr_kyc_status: contact.kycStatus,
    rivr_tier: contact.tier,
    rivr_hours_played: (Math.floor(contact.secondsPlayed / 360) / 10).toFixed(1),
    rivr_last_visit: contact.lastVisitAt === null ? '' : contact.lastVisitAt.toISOString().slice(0, 10),
  };
}

/** A field of the reply, or undefined when it is not an object (a gateway's HTML page, say). */
function field(reply: unknown, ...path: (string | number)[]): unknown {
  let value = reply;
  for (const key of path) value = typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
  return value;
}

/** Maps a refusal to a failure: a rate limit or HubSpot down are tried again, anything else is refused. */
function failureFrom(status: number): AdapterFailure {
  if (status === 429) return { code: 'rate_limited' };
  if (status >= 500) return { code: 'unavailable' };
  return { code: 'rejected', reason: `HubSpot ${status}` };
}

/**
 * HubSpot's free CRM (#647): each member upserted as a contact, keyed by the member's id, and deleted for good on their
 * erasure.
 */
export function createHubSpotCrm({ accessToken, fetch = globalThis.fetch, timeoutMs = 10_000 }: HubSpotCrmOptions): CrmAdapter {
  const post = async (url: string, body: unknown): Promise<Response | null> => {
    try {
      return await fetch(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return null;
    }
  };
  return {
    async upsertContact(contact) {
      const response = await post(UPSERT_URL, { inputs: [{ idProperty: HUBSPOT_ID_PROPERTY, id: contact.memberId, properties: toHubSpotProperties(contact) }] });
      if (response === null) return err({ code: 'unavailable' });
      const reply: unknown = await response.json().catch(() => undefined);
      if (!response.ok) return err(failureFrom(response.status));
      // 207: some of the batch was refused, here its one contact.
      if (response.status === 207) return err({ code: 'rejected', reason: 'HubSpot 207' });
      const id = field(reply, 'results', 0, 'id');
      return ok({ id: typeof id === 'string' ? id : '' });
    },
    async deleteContact(memberId) {
      const response = await post(GDPR_DELETE_URL, { objectId: memberId, idProperty: HUBSPOT_ID_PROPERTY });
      if (response === null) return err({ code: 'unavailable' });
      // A member never sent has no contact to delete.
      if (response.ok || response.status === 404) return ok(null);
      return err(failureFrom(response.status));
    },
  };
}
