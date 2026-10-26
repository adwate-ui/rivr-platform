import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { RivrClient } from './client.ts';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** What must be settled before a member is erased (#424, decision 0207), in the order the database lists it. */
export type ErasureBlocker = 'frozen' | 'cash' | 'chips' | 'markers' | 'rewards' | 'redemptions' | 'waitlist' | 'tournament' | 'requests'
  | 'academy';

const BLOCKERS: readonly ErasureBlocker[] = [
  'frozen', 'cash', 'chips', 'markers', 'rewards', 'redemptions', 'waitlist', 'tournament', 'requests', 'academy',
];

/** What the erase section shows a super admin first. */
export interface ErasurePreview {
  readonly isErased: boolean;
  readonly blockers: readonly ErasureBlocker[];
  /** The points and bonus an erasure would forfeit to the club. */
  readonly points: number;
  readonly bonus: Paise;
  /** The end of a break whose block would stand; null for none. */
  readonly blockedUntil: string | null;
  /** KYC files of the member still in Storage: once erased, still to remove. */
  readonly kycFiles: number;
}

/** What an erasure did. `filesRemoved` is null when the KYC files are still to remove (ask again from the record). */
export interface Erasure {
  readonly forfeitedPoints: number;
  readonly forfeitedBonus: Paise;
  readonly blockedUntil: string | null;
  readonly filesRemoved: number | null;
}

/** Why an erasure did not go through. */
export type ErasureFailure = 'not_allowed' | 'wrong_name' | 'invalid_reason' | 'open_items' | 'erased' | 'too_soon' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, ErasureFailure>> = {
  '42501': 'not_allowed', RVNAM: 'wrong_name', '22023': 'invalid_reason', RVERA: 'open_items', RVERD: 'erased', RVRAT: 'too_soon',
  RVFRZ: 'paused', RVKIL: 'paused', RVMBR: 'paused',
};

/** The failure a refused erasure stands for. */
export function erasureFailureOf(error: { code: string }): ErasureFailure {
  return FAILURE_BY_CODE[error.code] ?? 'unavailable';
}

/** A blocker the database named; one this console does not know is a fault, never shown as another. */
export function erasureBlockerOf(value: string): ErasureBlocker {
  const found = BLOCKERS.find((known) => known === value);
  if (found === undefined) throw new Error(`Unknown erasure blocker: ${value}`);
  return found;
}

/** How many KYC files the member-erase Edge Function removed for an erased member; null when it could not. */
export function filesRemovedOf(data: unknown): number | null {
  const count: unknown = typeof data === 'object' && data !== null ? Reflect.get(data, 'filesRemoved') : null;
  return typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? count : null;
}

async function removeKycFiles(client: RivrClient, memberId: string): Promise<number | null> {
  const { data, error } = await client.functions.invoke('member-erase', { body: { memberId } });
  return error ? null : filesRemovedOf(data);
}

/** Reads the member's preview, record and the member lists again; nothing else, so a form keeps what was typed. */
function refresh(queryClient: QueryClient, user: string, venueId: string, memberId: string): void {
  void Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.memberErasurePreview(user, memberId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.memberRecord(user, venueId, memberId) }),
    queryClient.invalidateQueries({ queryKey: ['user', user, 'member-search'] }),
    queryClient.invalidateQueries({ queryKey: ['user', user, 'members-of-tier'] }),
  ]);
}

/** For a super admin of the member's venue: whether they are erased, what is open, what they would forfeit and the KYC files left. Null for anyone else. */
export function useMemberErasurePreview(memberId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.memberErasurePreview(userId ?? 'signed-out', memberId),
    enabled: userId !== null,
    queryFn: async (): Promise<ErasurePreview | null> => {
      const { data, error } = await client.rpc('member_erasure_preview', { p_member_id: memberId });
      if (error) throw error;
      const row = data[0];
      if (row === undefined) return null;
      return {
        isErased: row.is_erased, blockers: row.blockers.map(erasureBlockerOf), points: row.points, bonus: toPaise(row.bonus_paise),
        blockedUntil: row.blocked_until, kycFiles: row.kyc_files,
      };
    },
  });
}

/**
 * Erases the member, the full name typed and a reason, through the database itself (it is admin-computer work),
 * then has the member-erase Edge Function remove their KYC files. Resolves to what the erasure did, or why not.
 */
export function useEraseMember(venueId: string, memberId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fullName, reason }: { fullName: string; reason: string }): Promise<Result<Erasure, ErasureFailure>> => {
      const { data, error } = await client.rpc('erase_member', { p_member_id: memberId, p_full_name: fullName, p_reason: reason });
      if (error) return err(erasureFailureOf(error));
      const row = data[0];
      if (row === undefined) return err('unavailable');
      return ok({
        forfeitedPoints: row.forfeited_points, forfeitedBonus: toPaise(row.forfeited_bonus_paise), blockedUntil: row.blocked_until,
        filesRemoved: await removeKycFiles(client, memberId),
      });
    },
    onSettled: () => refresh(queryClient, userId ?? 'signed-out', venueId, memberId),
  });
}

/** Removes an erased member's KYC files still in Storage (the member-erase Edge Function): how many, or null when it could not. */
export function useRemoveErasedKycFiles(venueId: string, memberId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => removeKycFiles(client, memberId),
    onSettled: () => refresh(queryClient, userId ?? 'signed-out', venueId, memberId),
  });
}
