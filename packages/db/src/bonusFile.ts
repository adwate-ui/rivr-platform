import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** The most lines, and so members, a Bonus file holds (`bonus_from_file`). */
export const BONUS_FILE_MOST_LINES = 500;

/**
 * A member a Bonus file names, for its preview (the owner, 22 Nov): the key the file gave (a member number, or a phone as +91
 * and ten digits), who it is, their Bonus in force and what they owe, and whether they are the reader's own record.
 */
export interface BonusFileMember {
  readonly key: string;
  readonly memberId: string;
  readonly memberNumber: number;
  readonly fullName: string;
  readonly inForce: Paise;
  readonly owed: Paise;
  readonly isOwn: boolean;
}

/**
 * The members of the venue a Bonus file's keys name, for a super admin's preview; none for anyone else, nor for a member
 * erased or of another venue (`bonus_file_members`). Waits until there is a key to read.
 */
export function useBonusFileMembers(venueId: string, keys: readonly string[]) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.bonusFileMembers(userId ?? 'signed-out', venueId, keys.join(',')),
    enabled: userId !== null && keys.length > 0,
    queryFn: async (): Promise<BonusFileMember[]> => {
      const { data, error } = await client.rpc('bonus_file_members', { p_venue_id: venueId, p_keys: keys.slice(0, BONUS_FILE_MOST_LINES) });
      if (error) throw error;
      return data.map((row) => ({
        key: row.key, memberId: row.member_id, memberNumber: row.member_number, fullName: row.full_name, inForce: toPaise(row.in_force_paise),
        owed: toPaise(row.owed_paise), isOwn: row.is_own,
      }));
    },
  });
}

/** A line of a Bonus file as it is saved: its line in the file, whose, Add or Use, whole chips, and why. */
export interface BonusFileLineToSave {
  readonly line: number;
  readonly memberId: string;
  readonly kind: 'add' | 'use';
  readonly chips: number;
  readonly reason: string;
}

/**
 * Why a Bonus file did not save: not a super admin; a line for their own record; a line's chips not whole fifties from 50 to
 * 1,00,000; a line's member, type or reason (or the request) not as the database takes it; a Use of more than the Bonus in
 * force or while some is owed; frozen, or promotions stopped; too many at once; anything else.
 */
export type BonusFileFailure = 'not_allowed' | 'own_record' | 'invalid_chips' | 'invalid' | 'bonus_short' | 'paused' | 'busy' | 'unavailable';

/** A refusal, and the line of the file it names (null when it names none). */
export interface BonusFileRefusal {
  readonly failure: BonusFileFailure;
  readonly line: number | null;
}

const FAILURE_BY_CODE: Readonly<Record<string, BonusFileFailure>> = {
  '42501': 'not_allowed', RVOWN: 'own_record', RVCHP: 'invalid_chips', '22023': 'invalid', RVBON: 'bonus_short', RVFRZ: 'paused', RVKIL: 'paused',
  RVMBR: 'paused', RVRAT: 'busy',
};

/** The file's line a refusal's detail names, as `bonus_from_file` gives it. */
function lineOf(details: unknown): number | null {
  return typeof details === 'string' && /^[0-9]{1,6}$/.test(details) ? Number(details) : null;
}

/**
 * Saves a Bonus file (the owner, 22 Nov): a super admin's Adds and Uses, every line or none, in the file's order
 * (`bonus_from_file`). The same request id again is the same file. Resolves to how many lines went, or the refusal and the
 * line it names; reads again every member's Bonus at the venue (the members the file named among them), the Door's Wallet,
 * Bonus given, and the reports.
 */
export function useSaveBonusFile(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: { readonly lines: readonly BonusFileLineToSave[]; readonly requestId: string }): Promise<Result<number, BonusFileRefusal>> => {
      const lines = file.lines.map(({ line, memberId, kind, chips, reason }) => ({ line, member_id: memberId, kind, chips, reason }));
      const { data, error } = await client.rpc('bonus_from_file', { p_venue_id: venueId, p_lines: lines, p_request_id: file.requestId });
      const user = userId ?? 'signed-out';
      await Promise.all([queryKeys.bonusAt(user, venueId), queryKeys.doorBoard(user, venueId), queryKeys.bonusGiven(user, venueId), queryKeys.clubReportsAt(user, venueId)]
        .map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      if (error) return err({ failure: FAILURE_BY_CODE[error.code] ?? 'unavailable', line: lineOf(error.details) });
      return ok(data);
    },
  });
}
