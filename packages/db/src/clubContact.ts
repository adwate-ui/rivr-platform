import { err, ok, type Result } from '@rivr/contracts/result';
import { useQuery } from '@tanstack/react-query';
import type { RivrClient } from './client.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/**
 * The club's numbers for calls and WhatsApp, as set under Settings, Club (decision 0582): `+918796580435`, or null for one
 * the club has not set, which the website and the app then leave out.
 */
export interface ClubContact {
  readonly phone: string | null;
  readonly whatsapp: string | null;
}

/** Neither number: what a page shows when the club has set none, or they cannot be read. */
export const NO_CLUB_CONTACT: ClubContact = { phone: null, whatsapp: null };

// They change seldom: an open app reads them again after ten minutes, and every launch reads them afresh.
const CONTACT_STALE_MS = 10 * 60 * 1000;

/** The club's row of public_club_contact, which holds the club's alone. */
function contactFrom(rows: readonly { phone: string | null; whatsapp: string | null }[]): ClubContact {
  const row = rows[0];
  return row === undefined ? NO_CLUB_CONTACT : { phone: row.phone, whatsapp: row.whatsapp };
}

/** The club's numbers, as anyone may read them, for the website's server, once per request. `unavailable` when they cannot be read. */
export async function fetchClubContact(client: RivrClient): Promise<Result<ClubContact, 'unavailable'>> {
  const { data, error } = await client.from('public_club_contact').select('phone, whatsapp');
  return error ? err('unavailable') : ok(contactFrom(data));
}

/**
 * The club's numbers for the app's way to the front desk. A signed-in member's are kept on the phone with what the app
 * opens with offline (offlineCache.ts), so the desk can be called with no connection.
 */
export function useClubContact() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.clubContact(userId ?? 'signed-out'),
    staleTime: CONTACT_STALE_MS,
    queryFn: async (): Promise<ClubContact> => {
      const { data, error } = await client.from('public_club_contact').select('phone, whatsapp');
      if (error) throw error;
      return contactFrom(data);
    },
  });
}
