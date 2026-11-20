import type { Paise } from '@rivr/domain/money';
import { tablesOf, type TodaysPlayer } from './floorToday.ts';
import { useListPage, type ScopedView } from './lists.ts';
import { kycStatusOf, type MemberKycStatus } from './members.ts';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';

/** Where a player stands at the door today: as today's players have it (#641), and `expected` while on a waitlist and not yet in. */
export type DoorStatus = 'playing' | 'waiting' | 'in_room' | 'expected' | 'left' | 'never_arrived';

/** Which of the door's lists a player is on: in the club with a visit open, expected, left, or on a list today and never in. */
export type DoorListName = 'in_club' | 'expected' | 'left' | 'not_arrived';

/**
 * A member at the door today (redesign RD-30), a row per seat (the owner, 19 Nov): today's player (#641) with what the
 * front desk's lists gave (#72), their number, tier and ID check, and which of the door's lists they are on. `tables` holds
 * the seat's table alone; one with no seat yet has a row without one.
 */
export interface DoorPlayer extends Omit<TodaysPlayer, 'status' | 'waitingSeconds'> {
  readonly tierName: string;
  /** On the club's lowest tier, which the door leaves unsaid. */
  readonly isBaseTier: boolean;
  readonly status: DoorStatus;
  readonly list: DoorListName;
  /** The seat's time at its table less its time away, in seconds; 0 with no seat. */
  readonly playedSeconds: number;
  /** The row's visit's check-in and check-out are `checkedInAt` and `checkedOutAt`; when they sat at the seat's table and left it (null while there). */
  readonly seatedAt: string | null;
  readonly leftAt: string | null;
  /** The wait that ended in the seat, or the current or last one, from the later of check-in and joining the list; null with no check-in. */
  readonly waitingSeconds: number | null;
  readonly kycStatus: MemberKycStatus;
  /** When the member's open visit began, or, while expected, when they first joined a waitlist; null once they have left and are not back. */
  readonly since: string | null;
  /** The Bonus given to them today, by hand or by promotions once approved (#1062), on the first row of their latest visit alone; null on the rest. */
  readonly bonus: Paise | null;
  /**
   * The Bonus used at the row's seat (the owner, 19 Nov), and on the first row of a visit also what it used without a seat
   * (the owner, 20 Nov); null on a row without a seat that has none.
   */
  readonly bonusUsed: Paise | null;
  /** The row's seat session and its visit, which tell the rows apart; a row without a seat has no session, nor a visit when it is a wait outside. */
  readonly sessionId: string | null;
  readonly visitId: string | null;
  /** Their id for a link to their account; null once they are erased, whose name links nowhere. */
  readonly linkedMemberId: string | null;
  /** Their mobile, `+919876543210`, for floor and up (members.phone, #1073); null for anyone else. */
  readonly phone: string | null;
}

/** A figure in paise the server may leave out: Bonus on a member's later rows, or used with no seat. */
export const paiseOrNone = (value: number | null): Paise | null => (value === null ? null : toPaise(value));

const STATUSES: readonly DoorStatus[] = ['playing', 'waiting', 'in_room', 'expected', 'left', 'never_arrived'];
const LISTS: readonly DoorListName[] = ['in_club', 'expected', 'left', 'not_arrived'];

/**
 * One page of the door's list for staff who read members, sorted, searched and filtered on the server (`door_page`),
 * with how many the view leaves. The view's scope is the screen's choice of list: `in_club`, `expected`, `left`, or
 * everyone at the door today without one. Asked again every ten seconds.
 */
export function useDoorPage(venueId: string, view: ScopedView | null) {
  const { client } = useRivrData();
  return useListPage({
    list: 'door', venueId, view,
    read: (asked) => client.rpc('door_page', { p_venue_id: venueId, p_view: asked }),
    rowOf: (row): DoorPlayer => ({
      memberId: row.member_id, fullName: row.full_name, memberNumber: Number(row.member_number), tierName: row.tier_name, isBaseTier: row.is_base_tier,
      status: STATUSES.find((status) => status === row.status) ?? 'left', list: LISTS.find((list) => list === row.list) ?? 'not_arrived',
      checkedInAt: row.checked_in_at, checkedOutAt: row.checked_out_at, waitingSeconds: row.waiting_seconds, tables: tablesOf(row.tables),
      playedSeconds: Number(row.played_seconds), kycStatus: kycStatusOf(row.kyc_status), since: row.since, bonus: paiseOrNone(row.bonus_paise),
      phone: row.phone, seatedAt: row.seated_at, leftAt: row.left_at, bonusUsed: paiseOrNone(row.bonus_used_paise),
      sessionId: row.session_id, visitId: row.visit_id, linkedMemberId: row.linked_member_id,
    }),
  });
}
