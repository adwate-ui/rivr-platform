import type { Paise } from '@rivr/domain/money';
import { useQuery } from '@tanstack/react-query';
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
