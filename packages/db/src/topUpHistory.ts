import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { TopUpStatus } from './floorToday.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A top-up request of a past club day (redesign RD-32): who asked and where, who accepted it and marked it done, and how long each step took. */
export interface PastTopUp {
  readonly requestId: string;
  readonly tableName: string;
  readonly seat: number;
  readonly fullName: string;
  readonly status: TopUpStatus;
  readonly requestedAt: string;
  readonly acceptedBy: string | null;
  /** Whole seconds from asking to accepted; null when nobody accepted it. */
  readonly acceptedSeconds: number | null;
  readonly doneBy: string | null;
  /** Whole seconds from accepted to done; null unless it was fulfilled. */
  readonly doneSeconds: number | null;
}

/** One page of a day's requests, and how many the day has over every page. */
export interface TopUpHistoryPage {
  readonly rows: readonly PastTopUp[];
  readonly total: number;
}

const STATUSES: readonly TopUpStatus[] = ['requested', 'in_progress', 'fulfilled', 'reset', 'left'];
const statusOf = (value: string): TopUpStatus => STATUSES.find((status) => status === value) ?? 'requested';

/** How many requests a page holds. */
export const TOP_UP_HISTORY_PAGE = 50;

/**
 * A club day's top-up requests, the newest first, a page at a time from the server (`top_up_history`), for staff who
 * handle top-ups. `day` is the club day as `2026-11-15`. The page before stays on screen while the next loads.
 */
export function useTopUpHistory(venueId: string, day: string, page: number) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.topUpHistory(userId ?? 'signed-out', venueId, day, page),
    enabled: userId !== null && venueId !== '' && day !== '',
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<TopUpHistoryPage> => {
      const { data, error } = await client.rpc('top_up_history', { p_venue_id: venueId, p_day: day, p_page: page, p_page_size: TOP_UP_HISTORY_PAGE });
      if (error) throw error;
      return {
        total: Number(data[0]?.total ?? 0),
        rows: data.map((row) => ({
          requestId: row.request_id, tableName: row.table_name, seat: row.seat, fullName: row.full_name, status: statusOf(row.status), requestedAt: row.requested_at,
          acceptedBy: row.accepted_by, acceptedSeconds: row.accepted_seconds, doneBy: row.done_by, doneSeconds: row.done_seconds,
        })),
      };
    },
  });
}
