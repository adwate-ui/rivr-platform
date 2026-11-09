import { useQuery } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** One table over a span of club days (the owner, 8 Nov), money-free: how long it ran and how it was played. */
export interface TableMetrics {
  readonly tableId: string;
  readonly tableName: string;
  readonly seats: number;
  readonly runSeconds: number;
  /** Members who sat there. */
  readonly players: number;
  /** The most seated at once. */
  readonly peak: number;
  readonly playerSeconds: number;
  /** The same in the span just before, of the same length and as far as the same point in it (F-107). */
  readonly previousPlayerSeconds: number;
}

/** The whole room over a span (F-107): a member at two tables counts once, and the most at once is across the room. */
export interface TableMetricsTotal {
  readonly seats: number;
  readonly runSeconds: number;
  /** Each table's seats × the seconds it ran, for how full the room was. */
  readonly seatSeconds: number;
  readonly players: number;
  readonly peak: number;
  readonly playerSeconds: number;
  readonly previousPlayerSeconds: number;
}

/**
 * Each active table, and any other that ran or was played, over the club days `from` to `to` (YYYY-MM-DD, 1 to 92 days) at the venue, in the
 * floor's order, for staff who read reports (`table_metrics`).
 */
export function useTableMetrics(venueId: string, from: string, to: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tableMetrics(userId ?? 'signed-out', venueId, from, to),
    enabled: userId !== null,
    queryFn: async (): Promise<TableMetrics[]> => {
      const { data, error } = await client.rpc('table_metrics', { p_venue_id: venueId, p_from: from, p_to: to });
      if (error) throw error;
      return data.map((row) => ({
        tableId: row.table_id, tableName: row.table_name, seats: row.seats, runSeconds: Number(row.run_seconds), players: row.players,
        peak: row.peak, playerSeconds: Number(row.player_seconds), previousPlayerSeconds: Number(row.previous_player_seconds),
      }));
    },
  });
}

const NO_TOTAL: TableMetricsTotal = { seats: 0, runSeconds: 0, seatSeconds: 0, players: 0, peak: 0, playerSeconds: 0, previousPlayerSeconds: 0 };

/** The whole room over those club days, for the same staff (`table_metrics_total`). */
export function useTableMetricsTotal(venueId: string, from: string, to: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tableMetricsTotal(userId ?? 'signed-out', venueId, from, to),
    enabled: userId !== null,
    queryFn: async (): Promise<TableMetricsTotal> => {
      const { data, error } = await client.rpc('table_metrics_total', { p_venue_id: venueId, p_from: from, p_to: to });
      if (error) throw error;
      const row = data[0];
      if (row === undefined) return NO_TOTAL;
      return {
        seats: Number(row.seats), runSeconds: Number(row.run_seconds), seatSeconds: Number(row.seat_seconds), players: Number(row.players),
        peak: Number(row.peak), playerSeconds: Number(row.player_seconds), previousPlayerSeconds: Number(row.previous_player_seconds),
      };
    },
  });
}
