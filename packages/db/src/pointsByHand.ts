import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A member found by their number, with the points they hold (#645): earned to spend, and locked until unlocked. */
export interface MemberPoints {
  readonly memberId: string;
  readonly fullName: string;
  readonly memberNumber: number;
  readonly earned: bigint;
  readonly locked: bigint;
}

/** Why a points change was refused. */
export type PointsFailure = 'not_allowed' | 'no_member' | 'invalid' | 'not_enough_locked' | 'paused' | 'daily_limit' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, PointsFailure>> = {
  '42501': 'not_allowed', RVNOM: 'no_member', '22023': 'invalid', RVPTS: 'not_enough_locked', RVFRZ: 'paused', RVMBR: 'paused',
};

/** The member with this mobile number at the venue, and their points, for staff who keep the rewards; null when none is. */
export function useMemberPoints(venueId: string, phone: string | null) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.memberPoints(userId ?? 'signed-out', venueId, phone ?? ''),
    enabled: userId !== null && phone !== null,
    queryFn: async (): Promise<MemberPoints | null> => {
      const { data, error } = await client.rpc('member_points', { p_venue_id: venueId, p_phone: phone ?? '' });
      if (error) throw error;
      const row = data[0];
      return row === undefined ? null : {
        memberId: row.member_id, fullName: row.full_name, memberNumber: row.member_number, earned: BigInt(row.earned), locked: BigInt(row.locked),
      };
    },
  });
}

/** Points by hand: given as earned or as locked, or locked ones unlocked into earned. The request id makes a retry count once. */
export interface PointsOrder {
  readonly memberId: string;
  readonly action: 'earned' | 'locked' | 'unlock';
  readonly points: bigint;
  readonly reason: string;
  readonly requestId: string;
}

/** Gives or unlocks a member's points (rewards.manage); a Result, and the member's points reload. */
export function useGivePoints(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (order: PointsOrder): Promise<Result<null, PointsFailure>> => {
      const change = { p_member_id: order.memberId, p_points: Number(order.points), p_reason: order.reason.trim(), p_idempotency_key: order.requestId };
      const { data, error } = order.action === 'unlock'
        ? await client.rpc('unlock_points', change)
        : await client.rpc('grant_points', { ...change, p_is_locked: order.action === 'locked' });
      await queryClient.invalidateQueries({ queryKey: queryKeys.memberPointsAll(userId ?? 'signed-out', venueId) });
      if (error) return err(FAILURE_BY_CODE[error.code] ?? 'unavailable');
      // A change past the staff member's daily cap gives nothing and answers no transaction (#798); the owner is alerted.
      return order.action !== 'unlock' && data === null ? err('daily_limit') : ok(null);
    },
  });
}

/** The signed-in member's locked points (#645), shown on Rewards beside the earned points they spend. */
export function useMyLockedPoints() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myLockedPoints(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<bigint> => {
      const { data, error } = await client.rpc('my_locked_points');
      if (error) throw error;
      return BigInt(data ?? 0);
    },
  });
}
