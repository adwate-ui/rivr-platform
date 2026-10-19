import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A dealer whose PIN the signed-in manager may set (#41): whether they have one, and until when it is locked. */
export interface VenueDealer {
  readonly staffId: string;
  readonly fullName: string;
  readonly hasPin: boolean;
  readonly lockedUntil: string | null;
}

/** A dealer who can sign in on this tablet: one with a PIN at its venue. */
export interface TabletDealer {
  readonly staffId: string;
  readonly fullName: string;
}

/** A down ended with its drop-box count (#44): the count, the rake and drops its hands logged, and the count less logged. */
export interface DownCount {
  readonly dropBox: Paise;
  readonly logged: Paise;
  readonly variance: Paise;
}

/** The down at this tablet's table: who is dealing, since when. */
export interface CurrentDown {
  readonly downId: string;
  readonly staffId: string;
  readonly fullName: string;
  readonly startedAt: string;
}

/** Why a PIN was not set: the role may not set it, a PIN that is not four digits (or one digit four times), or anything else. */
export type DealerPinFailure = 'not_allowed' | 'invalid' | 'unavailable';

/** Why sign-in did not go through: a wrong PIN (with the tries left), a locked PIN, the venue frozen, or anything else. */
export type DealerSignInFailure =
  | { readonly reason: 'wrong_pin'; readonly triesLeft: number }
  | { readonly reason: 'locked' | 'paused' | 'unavailable' };

const PIN_FAILURE_BY_CODE: Readonly<Record<string, DealerPinFailure>> = { '42501': 'not_allowed', '22023': 'invalid' };

// The tablet asks again every half minute, so a down ended elsewhere (the dealer signing in at
// another table) reaches it without a restart.
const DOWN_CHECK = 30_000;
// And for the dealers every 15 seconds: a PIN set on the console reaches a locked tablet, which cannot be reloaded.
const DEALERS_CHECK = 15_000;

/** The venue's dealers whose PIN the signed-in manager may set, by name. */
export function useVenueDealers(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.venueDealers(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<VenueDealer[]> => {
      const { data, error } = await client.rpc('venue_dealers', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({ staffId: row.staff_id, fullName: row.full_name, hasPin: row.has_pin, lockedUntil: row.locked_until }));
    },
  });
}

/** Sets a dealer's four-digit PIN, which also clears a lock; reloads the list. */
export function useSetDealerPin(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ staffId, pin }: { staffId: string; pin: string }): Promise<Result<null, DealerPinFailure>> => {
      const { error } = await client.rpc('set_dealer_pin', { p_staff_id: staffId, p_pin: pin });
      await queryClient.invalidateQueries({ queryKey: queryKeys.venueDealers(userId ?? 'signed-out', venueId) });
      return error ? err(PIN_FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
}

/** The dealers who can sign in on this tablet, asked again every 15 seconds. */
export function useTabletDealers() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tabletDealers(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: DEALERS_CHECK,
    queryFn: async (): Promise<TabletDealer[]> => {
      const { data, error } = await client.rpc('tablet_dealers');
      if (error) throw error;
      return data.map((row) => ({ staffId: row.staff_id, fullName: row.full_name }));
    },
  });
}

/**
 * The down at this tablet's table; null between downs. Asked only once the tablet is fixed to a
 * table, and kept by table, so a tablet moved to another table never shows the old table's down.
 */
export function useCurrentDown(tableId: string | null) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.currentDown(userId ?? 'signed-out', tableId ?? 'no-table'),
    enabled: userId !== null && tableId !== null,
    refetchInterval: DOWN_CHECK,
    queryFn: async (): Promise<CurrentDown | null> => {
      const { data, error } = await client.rpc('current_down');
      if (error) throw error;
      const row = data[0];
      return row ? { downId: row.down_id, staffId: row.staff_id, fullName: row.full_name, startedAt: row.started_at } : null;
    },
  });
}

/**
 * On the tablet: `signIn` a dealer with their PIN, which starts their down and ends the one before;
 * `end` the down with the drop-box count, which gives the variance against what its hands logged.
 * Both reload the current down.
 */
export function useDownActions() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  // Every table's current down: the prefix of currentDown's key.
  const reload = () => queryClient.invalidateQueries({ queryKey: ['user', userId ?? 'signed-out', 'current-down'] });
  const signIn = useMutation({
    mutationFn: async ({ staffId, pin }: { staffId: string; pin: string }): Promise<Result<null, DealerSignInFailure>> => {
      const { data, error } = await client.rpc('dealer_sign_in', { p_staff_id: staffId, p_pin: pin });
      await reload();
      if (error) return err({ reason: error.code === 'RVFRZ' ? 'paused' : 'unavailable' });
      const row = data[0];
      if (row?.refusal === 'wrong_pin') return err({ reason: 'wrong_pin', triesLeft: row.tries_left ?? 0 });
      if (row?.refusal === 'locked') return err({ reason: 'locked' });
      return row?.down_id ? ok(null) : err({ reason: 'unavailable' });
    },
  });
  const end = useMutation({
    mutationFn: async (dropBox: Paise): Promise<Result<DownCount, 'unavailable'>> => {
      const { data, error } = await client.rpc('end_down', { p_drop_box_paise: Number(dropBox) });
      await reload();
      const row = data?.[0];
      return error || row === undefined ? err('unavailable')
        : ok({ dropBox, logged: toPaise(row.logged_paise), variance: toPaise(row.variance_paise) });
    },
  });
  return { signIn, end };
}
