import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** What a line of bonus history is: chips given, chips used with a buy-in, or chips that ended before bonus stopped expiring. */
export type BonusLineKind = 'credited' | 'redeemed' | 'expired';

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
}

/** A line as staff see it on the member's record: also who seated the member when the chips were used. */
export interface MemberBonusLine extends BonusLine {
  readonly staffName: string | null;
}

const KINDS: readonly BonusLineKind[] = ['credited', 'redeemed', 'expired'];

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
}

function lineOf(row: LineRow): BonusLine {
  return { id: row.line_id, at: row.at, kind: kindOf(row.kind), amount: toPaise(row.amount_paise), reason: row.reason, tableName: row.table_name };
}

/** The signed-in member's bonus chips in force; null for someone who is no member. */
export function useMyBonus() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myBonus(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<Paise | null> => {
      const { data, error } = await client.rpc('my_bonus');
      if (error) throw error;
      const row = data[0];
      return row === undefined ? null : toPaise(row.bonus_paise);
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
      const { data, error } = await client.rpc('member_bonus', { p_venue_id: venueId, p_member_id: memberId ?? '' });
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
      const { data, error } = await client.rpc('member_bonus_visit_left', { p_venue_id: venueId, p_member_id: memberId ?? '' });
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
 * their daily limit; anything else.
 */
export type GiveBonusFailure = 'not_allowed' | 'own_record' | 'invalid_chips' | 'invalid_reason' | 'paused' | 'daily_limit' | 'unavailable';

const GIVE_FAILURE_BY_CODE: Readonly<Record<string, GiveBonusFailure>> = {
  '42501': 'not_allowed', RVOWN: 'own_record', RVCHP: 'invalid_chips', '22023': 'invalid_reason', RVFRZ: 'paused', RVKIL: 'paused', RVMBR: 'paused',
};

/** Bonus chips added by hand: how many, why, and the request id that makes a retry the same grant. */
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
