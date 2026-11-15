import { useQuery } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A high hand the floor logged and paid (redesign RD-22): who, where, the hand as it was paid, its Bonus in chips, and who logged it. */
export interface HighHandHit {
  readonly id: string;
  readonly at: string;
  readonly memberId: string;
  readonly memberName: string;
  readonly tableName: string;
  readonly seat: number;
  readonly hand: string;
  readonly rank: string | null;
  readonly chips: number;
  readonly loggedBy: string;
}

/** Tonight's high hands: how many were paid and how much Bonus in all, and the newest of them, newest first. */
export interface HighHandTonight {
  readonly handsPaid: number;
  readonly chipsPaid: number;
  readonly hits: readonly HighHandHit[];
}

interface HitRow {
  hit_id: string; logged_at: string; member_id: string; member_name: string; table_name: string; seat: number; hand: string; rank: string | null;
  chips: number; logged_by: string; paid_count: number; paid_chips: number;
}

/** The rows of high_hand_tonight as the console shows them; the night's totals ride on every row. */
export function toHighHandTonight(rows: readonly HitRow[]): HighHandTonight {
  return {
    handsPaid: Number(rows[0]?.paid_count ?? 0),
    chipsPaid: Number(rows[0]?.paid_chips ?? 0),
    hits: rows.map((row) => ({
      id: row.hit_id, at: row.logged_at, memberId: row.member_id, memberName: row.member_name, tableName: row.table_name, seat: row.seat, hand: row.hand,
      rank: row.rank, chips: Number(row.chips), loggedBy: row.logged_by,
    })),
  };
}

// The newest hits listed; the night's totals count every one.
const LISTED = 50;

/**
 * Tonight's high hands at a venue, for staff who seat players or manage promotions (`high_hand_tonight`): the whole
 * venue's, or with `promotionId` that promotion's alone, as its record shows them.
 */
export function useHighHandTonight(venueId: string, promotionId: string | null = null, isEnabled = true) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.highHandTonight(userId ?? 'signed-out', venueId, promotionId),
    enabled: userId !== null && isEnabled,
    queryFn: async (): Promise<HighHandTonight> => {
      const only = promotionId === null ? {} : { p_promotion_id: promotionId };
      const { data, error } = await client.rpc('high_hand_tonight', { p_venue_id: venueId, p_limit: LISTED, ...only });
      if (error) throw error;
      return toHighHandTonight(data);
    },
  });
}
