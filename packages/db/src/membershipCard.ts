import { useQuery, type Query } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** The signed-in member's card as the player app shows it (#71). */
export interface MembershipCardView {
  readonly memberNumber: string;
  readonly fullName: string;
  readonly tierName: string;
  /** What the card's QR holds now: the door's scanner reads it. */
  readonly code: string;
  /** How long until the code changes, by the database's clock, when it was fetched. */
  readonly msLeft: number;
}

// Never asks more often than this.
const SOONEST = 1_000;

/**
 * How long until the card's code changes, so the next one is asked for then. Measured from when the card
 * arrived, by the phone's clock both times, so a phone set wrong still asks on time (decision 0162).
 */
function untilChange(query: Query<MembershipCardView | null>): number | false {
  const card = query.state.data;
  return card ? Math.max(SOONEST, query.state.dataUpdatedAt + card.msLeft - Date.now()) : false;
}

/**
 * The signed-in member's membership card, made the first time it is asked for, with the code for now; null
 * for someone who is not a member. It asks again the moment the code changes, so the QR on screen is current.
 */
export function useMembershipCard() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.membershipCard(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: untilChange,
    queryFn: async (): Promise<MembershipCardView | null> => {
      const { data, error } = await client.rpc('my_membership_card');
      if (error) throw error;
      const row = data[0];
      if (row === undefined) return null;
      return { memberNumber: String(row.member_number), fullName: row.full_name, tierName: row.tier_name, code: row.code, msLeft: row.ms_left };
    },
  });
}
