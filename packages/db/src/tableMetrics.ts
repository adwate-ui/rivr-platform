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
}

/**
 * Each table that ran or was played over the club days `from` to `to` (YYYY-MM-DD, 1 to 92 days) at the venue, in the
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
        peak: row.peak, playerSeconds: Number(row.player_seconds),
      }));
    },
  });
}
