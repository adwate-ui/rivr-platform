import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** One member on the door's lists (#72): expected (on a waitlist, not yet in the room) or in the room since check-in. */
export interface DoorMember {
  readonly memberId: string;
  readonly fullName: string;
  readonly tierName: string;
  readonly isInRoom: boolean;
  /** When they checked in, or, while expected, when they first joined a waitlist. */
  readonly since: string;
}

/**
 * Why a member was not checked in: not the front desk, no member with that number here, on a break
 * from play (#56), the member or the venue frozen, or anything else.
 */
export type CheckInFailure = 'not_allowed' | 'no_member' | 'on_break' | 'stopped' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, CheckInFailure>> = {
  '42501': 'not_allowed', RVNOM: 'no_member', RVBRK: 'on_break', RVMBR: 'stopped', RVFRZ: 'paused',
};

// The door's lists change as members arrive and join from the app.
const LIVE = 10_000;

/** The venue's expected members and who is in the room, for the front desk (waitlist.manage), earliest first. */
export function useDoorBoard(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.doorBoard(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: LIVE,
    queryFn: async (): Promise<DoorMember[]> => {
      const { data, error } = await client.rpc('door_board', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({ memberId: row.member_id, fullName: row.full_name, tierName: row.tier_name, isInRoom: row.is_in_room, since: row.since }));
    },
  });
}

/** Checks a member in, from the expected list or by mobile number; each resolves to the visit's id and reloads the lists. */
export function useCheckInActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async ({ data, error }: { data: string | null; error: { code: string } | null }): Promise<Result<string, CheckInFailure>> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.doorBoard(userId ?? 'signed-out', venueId) });
    return error || data === null ? err(FAILURE_BY_CODE[error?.code ?? ''] ?? 'unavailable') : ok(data);
  };
  const checkIn = useMutation({
    mutationFn: async (memberId: string) => settle(await client.rpc('check_in', { p_venue_id: venueId, p_member_id: memberId })),
  });
  const checkInByPhone = useMutation({
    mutationFn: async (phone: string) => settle(await client.rpc('check_in_by_phone', { p_venue_id: venueId, p_phone: phone })),
  });
  return { checkIn, checkInByPhone };
}
