import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** What a line of points history is: earned (a visit, a promotion, by hand), spent on a reward, back from a cancelled redemption, given locked, or released to spend. */
export type PointsLineKind = 'earned' | 'spent' | 'returned' | 'locked' | 'released';

/** One line of a member's points: when, what, how many, and what it was for. */
export interface PointsLine {
  readonly id: string;
  readonly at: string;
  readonly kind: PointsLineKind;
  readonly points: bigint;
  readonly reason: string;
}

const KINDS: readonly PointsLineKind[] = ['earned', 'spent', 'returned', 'locked', 'released'];

function kindOf(text: string): PointsLineKind {
  return KINDS.find((kind) => kind === text) ?? 'earned';
}

/** The signed-in member's newest `count` lines of points history, newest first (rewards.points_history; none without it). */
export function useMyPointsHistory(count: number) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myPointsHistory(userId ?? 'signed-out', count),
    enabled: userId !== null,
    // Asking for more keeps the lines on screen until they come.
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<PointsLine[]> => {
      const { data, error } = await client.rpc('my_points_history', { p_limit: count });
      if (error) throw error;
      return data.map((row) => ({ id: row.line_id, at: row.at, kind: kindOf(row.kind), points: BigInt(row.points), reason: row.reason }));
    },
  });
}

/** A line as staff read it on the record (F-017): who posted it, when it was someone. */
export interface MemberPointsLine extends PointsLine {
  readonly staffName: string | null;
}

/** A member's newest `count` lines of points, newest first (members.read). */
export function useMemberPointsHistory(venueId: string, memberId: string, count: number) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.memberPointsHistory(userId ?? 'signed-out', venueId, memberId, count),
    enabled: userId !== null,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<MemberPointsLine[]> => {
      const { data, error } = await client.rpc('member_points_history', { p_venue_id: venueId, p_member_id: memberId, p_limit: count });
      if (error) throw error;
      return data.map((row) => ({ id: row.line_id, at: row.at, kind: kindOf(row.kind), points: BigInt(row.points), reason: row.reason, staffName: row.staff_name }));
    },
  });
}
