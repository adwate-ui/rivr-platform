import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** Why a number was not changed: not a super admin, a number or reason out of bounds, a number another holds, an erased member, a freeze, or anything else. */
export type PhoneChangeFailure = 'not_allowed' | 'invalid' | 'taken' | 'erased' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, PhoneChangeFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', RVPHN: 'taken', RVERD: 'erased', RVFRZ: 'paused', RVMBR: 'paused',
};

/**
 * A super admin changes a member's phone number, their login, with a reason (#502, decision 0248): audited, and
 * the owner alerted. The member's record and the searches reload.
 */
export function useChangeMemberPhone(venueId: string, memberId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ phone, reason }: { phone: string; reason: string }): Promise<Result<null, PhoneChangeFailure>> => {
      const { error } = await client.rpc('change_member_phone', { p_member_id: memberId, p_phone: phone.trim(), p_reason: reason.trim() });
      const user = userId ?? 'signed-out';
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.memberRecord(user, venueId, memberId) }),
        queryClient.invalidateQueries({ queryKey: ['user', user, 'member-search'] }),
      ]);
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
}
