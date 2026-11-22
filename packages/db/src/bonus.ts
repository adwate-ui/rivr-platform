import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';
import { LIST_MOST } from './limits.ts';

/**
 * What a line of bonus history is: chips given, chips used (with a buy-in, at a table; or without a seat, with no table),
 * chips that ended before bonus stopped expiring, or Bonus a super admin reversed (#1077; its id is the grant's, as an
 * expiry's is).
 */
export type BonusLineKind = 'credited' | 'redeemed' | 'expired' | 'reversed';

/**
 * One line of a member's bonus chips (decision 0504): when, what, how many (in paise: 1 chip is ₹1, as formatChips shows
 * it), the promotion's name or other reason for chips given, and the table for chips used.
 */
export interface BonusLine {
  readonly id: string;
  readonly at: string;
  readonly kind: BonusLineKind;
  readonly amount: Paise;
  readonly reason: string | null;
  readonly tableName: string | null;
  /** The hand a high hand paid for chips given (redesign RD-25); null for any other line, and on a member's record. */
  readonly highHand: { readonly hand: string; readonly rank: string | null } | null;
}

/** A line as staff see it on the member's record: also who seated the member when the chips were used. */
export interface MemberBonusLine extends BonusLine {
  readonly staffName: string | null;
}

const KINDS: readonly BonusLineKind[] = ['credited', 'redeemed', 'expired', 'reversed'];

function kindOf(text: string): BonusLineKind {
  return KINDS.find((kind) => kind === text) ?? 'credited';
}

interface LineRow {
  line_id: string;
  at: string;
  kind: string;
  amount_paise: number;
  reason: string | null;
  table_name: string | null;
  /** The member's own history alone has them (my_bonus_history). */
  hand?: string | null;
  rank?: string | null;
}

function lineOf(row: LineRow): BonusLine {
  const highHand = typeof row.hand === 'string' ? { hand: row.hand, rank: row.rank ?? null } : null;
  return { id: row.line_id, at: row.at, kind: kindOf(row.kind), amount: toPaise(row.amount_paise), reason: row.reason, tableName: row.table_name, highHand };
}

/**
 * A member's own Bonus: what is in force, and the card's line as Content sets it (#1065; null keeps the app's own). The card
 * never says when Bonus expires (the owner, 18 Nov), so the expiry days `my_bonus` also returns are not read (#1079).
 */
export interface MyBonus {
  readonly balance: Paise;
  readonly line: string | null;
}

/** The signed-in member's Bonus in force; null for someone who is no member. */
export function useMyBonus() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myBonus(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<MyBonus | null> => {
      const { data, error } = await client.rpc('my_bonus').limit(LIST_MOST);
      if (error) throw error;
      const row = data[0];
      return row === undefined ? null : { balance: toPaise(row.bonus_paise), line: row.bonus_line };
    },
  });
}

/** The signed-in member's newest `count` lines of bonus history, newest first. */
export function useMyBonusHistory(count: number) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myBonusHistory(userId ?? 'signed-out', count),
    enabled: userId !== null,
    // Asking for more keeps the lines on screen until they come.
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<BonusLine[]> => {
      const { data, error } = await client.rpc('my_bonus_history', { p_limit: count });
      if (error) throw error;
      return data.map(lineOf);
    },
  });
}

/** A member's bonus chips in force, for staff who open member records; null for anyone else, or with no member yet. */
export function useMemberBonus(venueId: string, memberId: string | null) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.memberBonus(userId ?? 'signed-out', venueId, memberId ?? 'none'),
    enabled: userId !== null && memberId !== null,
    queryFn: async (): Promise<Paise | null> => {
      const { data, error } = await client.rpc('member_bonus', { p_venue_id: venueId, p_member_id: memberId ?? '' }).limit(LIST_MOST);
      if (error) throw error;
      const row = data[0];
      return row === undefined ? null : toPaise(row.bonus_paise);
    },
  });
}

/**
 * What a member may still redeem this visit under the venue's bonus.visit_cap (decision 0579), for staff who open member
 * records: null where no cap is set, or for a member not at the venue.
 */
export function useMemberBonusVisitLeft(venueId: string, memberId: string | null) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.memberBonusVisitLeft(userId ?? 'signed-out', venueId, memberId ?? 'none'),
    enabled: userId !== null && memberId !== null,
    queryFn: async (): Promise<Paise | null> => {
      const { data, error } = await client.rpc('member_bonus_visit_left', { p_venue_id: venueId, p_member_id: memberId ?? '' }).limit(LIST_MOST);
      if (error) throw error;
      const left = data[0]?.left_paise;
      return left === undefined || left === null ? null : toPaise(left);
    },
  });
}

/** A member's newest `count` lines of bonus history, newest first, with who seated them, for staff who open member records. */
export function useMemberBonusHistory(venueId: string, memberId: string, count: number) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.memberBonusHistory(userId ?? 'signed-out', venueId, memberId, count),
    enabled: userId !== null,
    queryFn: async (): Promise<MemberBonusLine[]> => {
      const { data, error } = await client.rpc('member_bonus_history', { p_venue_id: venueId, p_member_id: memberId, p_limit: count });
      if (error) throw error;
      return data.map((row) => ({ ...lineOf(row), staffName: row.staff_name }));
    },
  });
}

/**
 * Why bonus chips added by hand did not go through: not in the staff member's role; their own member record; not whole
 * fifties from 50 to 1,00,000; no reason of 3 to 200 characters; the venue or member frozen, or promotions stopped; past
 * their daily limit; more than the club lets an admin or a floor manager add at once (bonus.by_hand_cap, redesign RD-19);
 * anything else.
 */
export type GiveBonusFailure = 'not_allowed' | 'own_record' | 'invalid_chips' | 'invalid_reason' | 'paused' | 'daily_limit' | 'over_cap' | 'unavailable';

const GIVE_FAILURE_BY_CODE: Readonly<Record<string, GiveBonusFailure>> = {
  '42501': 'not_allowed', RVOWN: 'own_record', RVCHP: 'invalid_chips', RVCAP: 'over_cap', '22023': 'invalid_reason', RVFRZ: 'paused', RVKIL: 'paused', RVMBR: 'paused',
};

/**
 * The most the club lets an admin or a floor manager add by hand at once (bonus.by_hand_cap) as it is in force now, for the
 * form's hint; null while none is set. Every member of staff reads their venue's settings. The database is what refuses.
 */
export function useBonusByHandCap(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.bonusByHandCap(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await client.from('setting').select('value').eq('venue_id', venueId).eq('key', 'bonus.by_hand_cap')
        .lte('effective_from', new Date().toISOString()).order('effective_from', { ascending: false }).limit(1);
      if (error) throw error;
      const value = data[0]?.value;
      const chips = typeof value === 'object' && value !== null && !Array.isArray(value) ? value['chips'] : undefined;
      return typeof chips === 'number' ? chips : null;
    },
  });
}

/** Bonus chips added or used by hand: how many, why, and the request id that makes a retry the same grant or use. */
export interface BonusGift {
  readonly chips: number;
  readonly reason: string;
  readonly requestId: string;
}

/**
 * Adds bonus chips to a member's balance by hand: super admins, admins and floor managers (the owner, 9 Nov), with a reason, in
 * whole fifties from 50 to 1,00,000, and below a super admin within a daily limit (`give_bonus_chips`). Resolves to a Result and
 * reads the balance and history again.
 */
export function useGiveBonusChips(venueId: string, memberId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (gift: BonusGift): Promise<Result<null, GiveBonusFailure>> => {
      const { data, error } = await client.rpc('give_bonus_chips', {
        p_member_id: memberId, p_chips: gift.chips, p_reason: gift.reason, p_request_id: gift.requestId,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.memberBonus(userId ?? 'signed-out', venueId, memberId) });
      if (error) return err(GIVE_FAILURE_BY_CODE[error.code] ?? 'unavailable');
      // Past the staff member's daily limit nothing is added and no grant comes back; the owner is alerted.
      return data === null ? err('daily_limit') : ok(null);
    },
  });
}

/**
 * Why Bonus used without a seat did not go: not in the staff member's role; their own member record; not whole fifties from
 * 50 to 1,00,000; no reason of 3 to 200 characters; the member not checked in; more than the Bonus in force (or some owed);
 * more than the visit's limit leaves (bonus.visit_cap); the venue or member frozen, or promotions stopped; too many at once;
 * anything else.
 */
export type UseBonusFailure =
  | 'not_allowed' | 'own_record' | 'invalid_chips' | 'invalid_reason' | 'not_checked_in' | 'bonus_short' | 'visit_cap' | 'paused' | 'busy' | 'unavailable';

const USE_FAILURE_BY_CODE: Readonly<Record<string, UseBonusFailure>> = {
  '42501': 'not_allowed', RVOWN: 'own_record', RVCHP: 'invalid_chips', '22023': 'invalid_reason', RVNIN: 'not_checked_in', RVBON: 'bonus_short',
  RVVCP: 'visit_cap', RVFRZ: 'paused', RVKIL: 'paused', RVMBR: 'paused', RVRAT: 'busy',
};

/**
 * Uses a member's Bonus without a seat (the owner, 20 Nov): super admins, admins and floor managers, while the member is
 * checked in, in whole fifties with a reason, within what they hold and their visit's limit (`use_bonus`). The same request id
 * again is the same use. Resolves to a Result and reads the balance, the histories, the door and Players visits again.
 */
export function useUseBonus(venueId: string, memberId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (use: BonusGift): Promise<Result<null, UseBonusFailure>> => {
      const { error } = await client.rpc('use_bonus', { p_member_id: memberId, p_chips: use.chips, p_reason: use.reason, p_request_id: use.requestId });
      const user = userId ?? 'signed-out';
      await Promise.all([queryKeys.memberBonus(user, venueId, memberId), queryKeys.doorBoard(user, venueId), queryKeys.playerVisits(user, venueId)]
        .map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      return error ? err(USE_FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
}

/**
 * Why a reversal or a missed use did not go: not one who corrects Bonus (bonus.correct), their own record, not whole fifties, the reason or seat,
 * nothing of the grant left (it expired), frozen, too many at once, or the line.
 */
export type CorrectBonusFailure = 'not_allowed' | 'own_record' | 'invalid_chips' | 'invalid' | 'nothing_left' | 'paused' | 'busy' | 'unavailable';

const CORRECT_FAILURE_BY_CODE: Readonly<Record<string, CorrectBonusFailure>> = {
  '42501': 'not_allowed', RVOWN: 'own_record', RVCHP: 'invalid_chips', '22023': 'invalid', RVNIL: 'nothing_left', RVFRZ: 'paused', RVKIL: 'paused',
  RVMBR: 'paused', RVRAT: 'busy',
};

/** Why a missed use did not go: as a reversal, or, for anyone but a super admin, past the Bonus in force or with some owed (decision 0709). */
export type MissedUseFailure = CorrectBonusFailure | 'bonus_short';

const MISSED_USE_FAILURE_BY_CODE: Readonly<Record<string, MissedUseFailure>> = { ...CORRECT_FAILURE_BY_CODE, RVBON: 'bonus_short' };

/**
 * Super admins and cashiers (bonus.correct, decision 0709) reverse a Bonus given (#1077, the owner, 18 Nov): the whole of it comes back, even if part was used, less
 * what expired, so the balance may go below zero. Resolves to what came back; null when it was reversed already.
 */
export function useReverseBonus(venueId: string, memberId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reversal: { readonly grantId: string; readonly reason: string }): Promise<Result<Paise | null, CorrectBonusFailure>> => {
      const { data, error } = await client.rpc('reverse_bonus', { p_grant_id: reversal.grantId, p_reason: reversal.reason });
      await queryClient.invalidateQueries({ queryKey: queryKeys.memberBonus(userId ?? 'signed-out', venueId, memberId) });
      if (error) return err(CORRECT_FAILURE_BY_CODE[error.code] ?? 'unavailable');
      return ok(data === null ? null : toPaise(data));
    },
  });
}

/** A seat a missed Bonus use may be added to: its table and seat, and when it started and ended (null while taken). */
export interface BonusUseSeat {
  readonly sessionId: string;
  readonly tableName: string;
  readonly seat: number;
  readonly startedAt: string;
  readonly endedAt: string | null;
}

/**
 * The member's newest `count` seats past their Undo, from any visit, for a super admin to add a missed Bonus use to; none
 * for anyone else. More as Show earlier asks, as the Bonus history reads.
 */
export function useBonusUseSeats(venueId: string, memberId: string, count: number) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.bonusUseSeats(userId ?? 'signed-out', venueId, memberId, count),
    enabled: userId !== null,
    // Asking for more keeps the seats on screen until they come.
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<BonusUseSeat[]> => {
      const { data, error } = await client.rpc('bonus_use_seats', { p_venue_id: venueId, p_member_id: memberId, p_limit: count });
      if (error) throw error;
      return data.map((row) => ({ sessionId: row.session_id, tableName: row.table_name, seat: row.seat, startedAt: row.started_at, endedAt: row.ended_at }));
    },
  });
}

/** A missed Bonus use: the seat, how many in whole fifties, why, and one request id until it goes through. */
export interface MissedBonusUse {
  readonly sessionId: string;
  readonly chips: number;
  readonly reason: string;
  readonly requestId: string;
}

/**
 * Super admins and cashiers add a Bonus use a seat missed (#1077): it counts on the seat's own day, with no visit cap; a super
 * admin's alone may take the balance below zero (decision 0709). The same request id again is the same use.
 */
export function useAddBonusUse(venueId: string, memberId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (use: MissedBonusUse): Promise<Result<null, MissedUseFailure>> => {
      const { error } = await client.rpc('add_bonus_use', {
        p_session_id: use.sessionId, p_chips: use.chips, p_reason: use.reason, p_request_id: use.requestId,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.memberBonus(userId ?? 'signed-out', venueId, memberId) });
      return error ? err(MISSED_USE_FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
}
