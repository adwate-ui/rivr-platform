import { z } from 'zod';
import { CONTACT_KINDS } from './incidents.ts';

// Bigint paise arrive from the database API as JSON numbers, well inside what a number holds exactly.
const paise = z.number().int();

/**
 * A venue's offline pack as `public.offline_pack(venue)` returns it (#168; decision 0260), which the nightly job reads
 * as the service role and @rivr/render draws: who to call, money held and owed, the cage, the floor and the SOPs.
 */
export const offlinePackRowSchema = z.object({
  issuer: z.object({ legal_name: z.string(), address: z.string(), gstin: z.string().nullable() }).nullable(),
  venue_name: z.string(),
  generated_at: z.string(),
  contacts: z.array(z.object({ kind: z.enum(CONTACT_KINDS), name: z.string(), role: z.string().nullable(), phone: z.string(), note: z.string().nullable() })),
  balances: z.array(z.object({ name: z.string(), member_number: z.string(), wallet_paise: paise, markers_paise: paise })),
  wallets_paise: paise,
  markers_paise: paise,
  chips_in_play_paise: paise,
  /** Null when no cage shift was open as the pack was made. */
  cage_float_paise: paise.nullable(),
  tables: z.array(z.object({
    name: z.string(), game: z.string(), seats: z.array(z.object({ seat: z.number().int(), name: z.string(), member_number: z.string() })),
  })),
  waitlist: z.array(z.object({ game: z.string(), place: z.number().int(), name: z.string(), member_number: z.string() })),
  sops: z.array(z.object({ title: z.string(), version: z.number().int(), in_force_from: z.string(), body: z.string() })),
});
export type OfflinePackRow = z.infer<typeof offlinePackRowSchema>;

/** The venues the nightly job makes a pack for, as `public.offline_pack_venues()` returns them: never the practice venue. */
export const offlinePackVenuesSchema = z.array(z.object({ venue_id: z.uuid() }));

/** What Storage lists of a venue's packs, newest first. */
export const storedPacksSchema = z.array(z.object({ name: z.string() }));
