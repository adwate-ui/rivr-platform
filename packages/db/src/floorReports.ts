import { clubDaysPeriod } from '@rivr/domain/clubDay';
import type { Paise } from '@rivr/domain/money';
import { useQuery } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

// What the floor and the owner read beside the live lists: games not running (#113) and pot data (#114).

/**
 * A game not running (#113, decision 0184): none of its tables is open, so its waitlist is its interest
 * list. How many wait, how many the venue wants before opening a table (null when not set), and whether
 * that many wait.
 */
export interface InterestList {
  readonly tableTypeId: string;
  readonly waiting: number;
  readonly playersToOpen: number | null;
  readonly isReady: boolean;
}

// As the waitlist board: the floor's lists ask again every ten seconds.
const INTEREST_CHECK = 10_000;

/** The venue's games not running, with their interest, for staff with waitlist.manage. */
export function useInterestLists(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.interestLists(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: INTEREST_CHECK,
    queryFn: async (): Promise<InterestList[]> => {
      const { data, error } = await client.rpc('interest_lists', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({ tableTypeId: row.table_type_id, waiting: row.waiting, playersToOpen: row.players_to_open, isReady: row.is_ready }));
    },
  });
}

/** A hand's variant, as the tablet logs it. */
export type PotVariant = 'holdem' | 'plo' | 'bomb_pot';

/** One hand in pot data (#114, decision 0185): when, where, who dealt, the variant and the money, and a high hand claimed on it. */
export interface PotHand {
  readonly handId: string;
  readonly playedAt: string;
  readonly tableId: string;
  readonly tableName: string;
  readonly dealerId: string;
  readonly dealerName: string;
  readonly variant: PotVariant;
  readonly pot: Paise;
  readonly rake: Paise;
  readonly drop: Paise;
  readonly isCapApplied: boolean;
  /** The category of a high hand claimed on it, such as `royal_flush`; null for none. */
  readonly highHand: string | null;
}

const VARIANTS: readonly PotVariant[] = ['holdem', 'plo', 'bomb_pot'];

/** Every hand at the venue on the club's days from `from` to `to`, newest first, at most 5,000 (pot_data.read). */
export function usePotData(venueId: string, from: string, to: string) {
  const { client, userId } = useRivrData();
  const days = clubDaysPeriod(from, to);
  const period = { start: days.start.toISOString(), end: days.end.toISOString() };
  return useQuery({
    queryKey: queryKeys.potData(userId ?? 'signed-out', venueId, period.start, period.end),
    enabled: userId !== null,
    queryFn: async (): Promise<PotHand[]> => {
      const { data, error } = await client.rpc('pot_data', { p_venue_id: venueId, p_from: period.start, p_until: period.end });
      if (error) throw error;
      return data.map((row) => ({
        handId: row.hand_id, playedAt: row.played_at, tableId: row.table_id, tableName: row.table_name, dealerId: row.dealer_id,
        dealerName: row.dealer_name, variant: VARIANTS.find((known) => known === row.variant) ?? 'holdem', pot: toPaise(row.pot_paise),
        rake: toPaise(row.rake_paise), drop: toPaise(row.drop_paise), isCapApplied: row.is_cap_applied, highHand: row.high_hand,
      }));
    },
  });
}
