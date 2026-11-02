import { useQuery } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

// Tonight's lists move as players ask, sit, wait and leave.
const LIVE = 15_000;

/** Where a top-up stands (#639): asked for, in hand, fulfilled, reset, or left open when the player left. */
export type TopUpStatus = 'requested' | 'in_progress' | 'fulfilled' | 'reset' | 'left';

/** A top-up request tonight, for the floor and the cashier (#639), with the seat session the floor acts on (decision 0299). */
export interface TopUpTonight {
  readonly requestId: string;
  readonly sessionId: string;
  readonly tableName: string;
  readonly seat: number;
  readonly fullName: string;
  readonly status: TopUpStatus;
  readonly requestedAt: string;
  /** Whole seconds from asking to fulfilled; null until it is. */
  readonly fulfilledSeconds: number | null;
}

const TOP_UP_STATUSES: readonly TopUpStatus[] = ['requested', 'in_progress', 'fulfilled', 'reset', 'left'];

/** A top-up still waiting for the floor: asked for, or in hand (decision 0299). */
export const isTopUpWaiting = (request: TopUpTonight) => request.status === 'requested' || request.status === 'in_progress';
const topUpStatusOf = (value: string): TopUpStatus => TOP_UP_STATUSES.find((status) => status === value) ?? 'requested';

/** Read every five seconds: the floor has sixty to bring a top-up (decision 0299). */
const TOP_UPS_LIVE = 5_000;

/** Tonight's top-up requests at the venue, by table, for staff who read members (`top_ups_tonight`). */
export function useTopUpsTonight(venueId: string, isEnabled = true) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.topUpsTonight(userId ?? 'signed-out', venueId),
    enabled: userId !== null && isEnabled,
    refetchInterval: TOP_UPS_LIVE,
    queryFn: async (): Promise<TopUpTonight[]> => {
      const { data, error } = await client.rpc('top_ups_tonight', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        requestId: row.request_id, sessionId: row.session_id, tableName: row.table_name, seat: row.seat, fullName: row.full_name, status: topUpStatusOf(row.status),
        requestedAt: row.requested_at, fulfilledSeconds: row.fulfilled_seconds,
      }));
    },
  });
}

/** Where a player stands today (#641). */
export type TodayStatus = 'playing' | 'waiting' | 'left';

/** A member at the club today (#641), with the tables they played on and the seconds on each. */
export interface TodaysPlayer {
  readonly memberId: string;
  readonly fullName: string;
  readonly memberNumber: number;
  readonly status: TodayStatus;
  readonly checkedInAt: string | null;
  readonly checkedOutAt: string | null;
  readonly waitingSeconds: number;
  readonly tables: readonly { readonly table: string; readonly seconds: number }[];
}

const statusOf = (value: string): TodayStatus => (value === 'playing' || value === 'waiting' ? value : 'left');

/** Each table a player played on, from the database's list; anything else is left out. */
function tablesOf(tables: unknown): TodaysPlayer['tables'] {
  if (!Array.isArray(tables)) return [];
  return tables.flatMap((entry: unknown) => {
    const table: unknown = typeof entry === 'object' && entry !== null ? Reflect.get(entry, 'table') : null;
    const seconds: unknown = typeof entry === 'object' && entry !== null ? Reflect.get(entry, 'seconds') : null;
    return typeof table === 'string' && typeof seconds === 'number' ? [{ table, seconds }] : [];
  });
}

/** Every member at the club this club day, for staff who read members (`todays_players`). */
export function useTodaysPlayers(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.todaysPlayers(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: LIVE,
    queryFn: async (): Promise<TodaysPlayer[]> => {
      const { data, error } = await client.rpc('todays_players', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        memberId: row.member_id, fullName: row.full_name, memberNumber: Number(row.member_number), status: statusOf(row.status),
        checkedInAt: row.checked_in_at, checkedOutAt: row.checked_out_at, waitingSeconds: row.waiting_seconds, tables: tablesOf(row.tables),
      }));
    },
  });
}
