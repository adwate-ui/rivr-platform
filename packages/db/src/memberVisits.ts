import { isLeaveReason, type LeaveReason } from '@rivr/contracts';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { sessionsOf, type WaitingSession } from './bonusApprovals.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** One visit on a member's record (F-017). */
export interface MemberVisit {
  readonly visitId: string;
  readonly openedAt: string;
  /** Null while they are in. */
  readonly closedAt: string | null;
  /** Every table of the visit; null with no seat. */
  readonly tables: string | null;
  readonly minutesPlayed: number;
  /** Whether the call time owed was met; null when no seat owed any. */
  readonly callTimeMet: boolean | null;
  readonly leftEarly: boolean;
  /** Why they left each table of the visit, in order (#1060); empty when none was said, or the seat is still open. */
  readonly leaveReasons: readonly LeaveReason[];
  /** Its seats, for a super admin who edits the visit (#1134); null for anyone else. */
  readonly sessions: readonly WaitingSession[] | null;
}

/** A member's newest `count` visits, newest first (members.read). */
export function useMemberVisits(venueId: string, memberId: string, count: number) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.memberVisits(userId ?? 'signed-out', venueId, memberId, count),
    enabled: userId !== null,
    // Asking for more keeps the lines on screen until they come.
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<MemberVisit[]> => {
      const { data, error } = await client.rpc('member_visits', { p_venue_id: venueId, p_member_id: memberId, p_limit: count });
      if (error) throw error;
      return data.map((row) => ({
        visitId: row.visit_id, openedAt: row.opened_at, closedAt: row.closed_at, tables: row.tables, minutesPlayed: row.minutes_played, callTimeMet: row.call_time_met,
        leftEarly: row.left_early, leaveReasons: (row.leave_reasons ?? []).filter(isLeaveReason), sessions: row.sessions === null ? null : sessionsOf(row.sessions),
      }));
    },
  });
}
