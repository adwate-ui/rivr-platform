import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** Why a member's hours were not reset: not a super admin, their own record, a reason out of bounds, the venue or the member frozen, or anything else. */
export type ResetHoursFailure = 'not_allowed' | 'own_record' | 'invalid' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, ResetHoursFailure>> = { '42501': 'not_allowed', RVOWN: 'own_record', '22023': 'invalid', RVFRZ: 'paused', RVMBR: 'paused', RVKIL: 'paused' };

/**
 * A super admin resets one member's counted hours, with a reason (redesign RD-36): from then they count from zero on the
 * TV's hours leaderboard, for a play-time Bonus and in the Members list's total, while past visits stay on the record
 * (`reset_member_hours`; the rule is @rivr/domain countedSeconds). Audited. The request id makes a retry the same reset.
 * The Members list reloads.
 */
export function useResetMemberHours(venueId: string, memberId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reason, requestId }: { reason: string; requestId: string }): Promise<Result<null, ResetHoursFailure>> => {
      const { error } = await client.rpc('reset_member_hours', { p_member_id: memberId, p_reason: reason.trim(), p_request_id: requestId });
      const user = userId ?? 'signed-out';
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.memberRecord(user, venueId, memberId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.membersListAll(user) }),
      ]);
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
}
