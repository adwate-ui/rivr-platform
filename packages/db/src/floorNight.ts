import type { Paise } from '@rivr/domain/money';
import { useQuery } from '@tanstack/react-query';
import type { HandVariant } from './hands.ts';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A table's night so far (#81): hands since 06:00 IST, hands in the last hour, the dealer now, and its rake. */
export interface TableNight {
  readonly tableId: string;
  readonly hands: number;
  readonly handsLastHour: number;
  readonly dealerName: string | null;
  /** Rake tonight; null for staff who do not read the ledger. */
  readonly rake: Paise | null;
  /** The rake rule in force: rate in basis points and the cap; null where none is set. */
  readonly rakeBasisPoints: number | null;
  readonly rakeCap: Paise | null;
}

/** The venue's night: each table's, and the rake tonight across them (null without the ledger). */
export interface FloorNight {
  readonly tables: readonly TableNight[];
  readonly rake: Paise | null;
}

/** One of a table's hands tonight, latest first: its number in the night, when, the game, and its pot and rake (null without the ledger). */
export interface TableHand {
  readonly handId: string;
  readonly number: number;
  readonly playedAt: string;
  readonly variant: HandVariant;
  readonly pot: Paise | null;
  readonly rake: Paise | null;
}

// Hands arrive from the tablets as they are played.
const LIVE = 10_000;
// The prototype lists a table's last three hands.
const RECENT_HANDS = 3;

/** The live floor's figures for tonight, for staff who read members. */
export function useFloorNight(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.floorNight(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: LIVE,
    queryFn: async (): Promise<FloorNight> => {
      const { data, error } = await client.rpc('floor_tonight', { p_venue_id: venueId });
      if (error) throw error;
      const venueRake = data[0]?.venue_rake_paise ?? null;
      return {
        rake: venueRake === null ? null : toPaise(venueRake),
        tables: data.map((row) => ({
          tableId: row.table_id, hands: row.hands, handsLastHour: row.hands_last_hour, dealerName: row.dealer_name,
          rake: row.rake_paise === null ? null : toPaise(row.rake_paise), rakeBasisPoints: row.rake_basis_points,
          rakeCap: row.rake_cap_paise === null ? null : toPaise(row.rake_cap_paise),
        })),
      };
    },
  });
}

/** A table's last hands tonight. */
export function useTableHands(tableId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tableHands(userId ?? 'signed-out', tableId),
    enabled: userId !== null,
    refetchInterval: LIVE,
    queryFn: async (): Promise<TableHand[]> => {
      const { data, error } = await client.rpc('table_hands', { p_table_id: tableId, p_limit: RECENT_HANDS });
      if (error) throw error;
      return data.map((row) => ({
        handId: row.hand_id, number: row.number, playedAt: row.played_at, variant: row.variant,
        pot: row.pot_paise === null ? null : toPaise(row.pot_paise),
        rake: row.rake_paise === null ? null : toPaise(row.rake_paise),
      }));
    },
  });
}
