import { clubDaysPeriod } from '@rivr/domain/clubDay';
import type { Paise } from '@rivr/domain/money';
import { useQuery } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

// The dealers' board (#124, decision 0252): who deals where and for how long, who rests, and each dealer's time,
// hands, rake and drop-box variance over a period, for staff who run the floor (floor.manage).

/** A dealer on the rotation board: dealing at a table now (due once past the rotation's minutes), or resting. */
export interface RotationDealer {
  readonly staffId: string;
  readonly dealerName: string;
  readonly state: 'dealing' | 'resting';
  /** The table dealt; null while resting. */
  readonly tableName: string | null;
  /** When the down began, or when the dealer began resting. */
  readonly since: string;
  readonly minutes: number;
  readonly isDue: boolean;
}

/** The board as it stands, read again each minute: dealing first, the due first; then resting, the longest first. */
export function useDealerRotation(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.dealerRotation(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: 60_000,
    queryFn: async (): Promise<RotationDealer[]> => {
      const { data, error } = await client.rpc('dealer_rotation', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        staffId: row.staff_id, dealerName: row.dealer_name, state: row.state === 'dealing' ? 'dealing' : 'resting', tableName: row.table_name,
        since: row.since, minutes: row.minutes, isDue: row.is_due,
      }));
    },
  });
}

/** One dealer's downs over a period: how many, the seconds dealt, hands and hands per hour, rake logged and the drop-box variance. */
export interface DealerNight {
  readonly staffId: string;
  readonly dealerName: string;
  readonly downs: number;
  readonly dealtSeconds: number;
  readonly hands: number;
  /** To one place; null with no time dealt. */
  readonly handsPerHour: number | null;
  readonly rake: Paise;
  /** The downs that ended in the period and were counted: what the drop box held less what their hands logged; null with none counted. */
  readonly variance: Paise | null;
  readonly countedDowns: number;
}

/** Each dealer's downs on the club's days from `from` to `to`, by name. */
export function useDealerNights(venueId: string, from: string, to: string) {
  const { client, userId } = useRivrData();
  const days = clubDaysPeriod(from, to);
  const period = { start: days.start.toISOString(), end: days.end.toISOString() };
  return useQuery({
    queryKey: queryKeys.dealerNights(userId ?? 'signed-out', venueId, period.start, period.end),
    enabled: userId !== null,
    queryFn: async (): Promise<DealerNight[]> => {
      const { data, error } = await client.rpc('dealer_nights', { p_venue_id: venueId, p_from: period.start, p_until: period.end });
      if (error) throw error;
      return data.map((row) => ({
        staffId: row.staff_id, dealerName: row.dealer_name, downs: row.downs, dealtSeconds: row.dealt_seconds, hands: row.hands,
        handsPerHour: row.hands_per_hour, rake: toPaise(row.rake_paise), variance: row.counted_downs > 0 ? toPaise(row.variance_paise) : null, countedDowns: row.counted_downs,
      }));
    },
  });
}
