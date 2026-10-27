import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** One table a reset to seed reloads (#104): its rows at the practice venue now and in its seed. */
export interface PracticeResetRow {
  readonly table: string;
  readonly now: number;
  readonly seed: number;
}

/** Why a reset to seed did not go through. */
export type PracticeResetFailure = 'not_allowed' | 'not_practice' | 'no_seed' | 'wrong_name' | 'paused' | 'too_soon' | 'held' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, PracticeResetFailure>> = {
  '42501': 'not_allowed', RVPRA: 'not_practice', RVSED: 'no_seed', RVNAM: 'wrong_name', RVFRZ: 'paused', RVKIL: 'paused',
  RVRAT: 'too_soon',
  // foreign_key_violation: a kill-switch control, which a reset keeps, names a member the reset removes.
  '23503': 'held',
};

/** The failure a refused preview or reset stands for. */
export function practiceResetFailureOf(error: { code: string }): PracticeResetFailure {
  return FAILURE_BY_CODE[error.code] ?? 'unavailable';
}

/** The dry run, for a super admin at the practice venue: each table a reset reloads, now and in the seed. */
export function usePracticeResetPreview(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.practiceResetPreview(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<PracticeResetRow[]> => {
      const { data, error } = await client.rpc('practice_reset_preview', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({ table: row.table_name, now: row.current_rows, seed: row.seed_rows }));
    },
  });
}

/** Reset to seed, once the venue's name is typed exactly. Everything the person reads is read again after. */
export function usePracticeReset(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (venueName: string): Promise<Result<null, PracticeResetFailure>> => {
      const { error } = await client.rpc('reset_practice_venue', { p_venue_id: venueId, p_venue_name: venueName });
      return error ? err(practiceResetFailureOf(error)) : ok(null);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user', userId ?? 'signed-out'] }),
  });
}

/** One table a live venue's purge deletes from (#432): the rows it would delete. */
export interface LivePurgeRow {
  readonly table: string;
  readonly rows: number;
}

/**
 * Why a purge or its files' removal did not go through: the venue not frozen, no saved archive with its KYC photos, the
 * practice venue, a control naming a member, the tables busy, or too many tries at once.
 */
export type LivePurgeFailure =
  | 'not_allowed' | 'practice' | 'not_frozen' | 'no_archive' | 'changed' | 'wrong_name' | 'held' | 'busy' | 'too_often' | 'unavailable';

const PURGE_FAILURE_BY_CODE: Readonly<Record<string, LivePurgeFailure>> = {
  '42501': 'not_allowed', RVPRC: 'practice', RVNFZ: 'not_frozen', RVARC: 'no_archive', RVCHG: 'changed', RVNAM: 'wrong_name',
  RVRAT: 'too_often',
  // foreign_key_violation: a kill-switch control, which a purge keeps, names a member the purge removes.
  '23503': 'held',
  // lock_not_available and deadlock_detected: another write held a table the purge locks.
  '55P03': 'busy', '40P01': 'busy',
};

/** The failure a refused purge preview, purge or file removal stands for. */
export function livePurgeFailureOf(error: { code: string }): LivePurgeFailure {
  return PURGE_FAILURE_BY_CODE[error.code] ?? 'unavailable';
}

// Kept here, not in queryKeys: only the Purge screen reads it.
const livePurgeKey = (userId: string, venueId: string) => ['user', userId, 'livePurgePreview', venueId] as const;

/** The dry run, for a super admin at a frozen live venue: each table a purge deletes from, with its rows. */
export function useLivePurgePreview(venueId: string, isFrozen: boolean) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: livePurgeKey(userId ?? 'signed-out', venueId),
    enabled: userId !== null && isFrozen,
    queryFn: async (): Promise<LivePurgeRow[]> => {
      const { data, error } = await client.rpc('live_purge_preview', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({ table: row.table_name, rows: row.current_rows }));
    },
  });
}

/** What removing a purge's files did: how many went, and how many are left to try again. */
export interface PurgedFiles {
  readonly removed: number;
  readonly left: number;
}

/** The refusal's code in the purge-venue function's answer, from supabase-js's error. */
async function purgeCodeOf(error: unknown): Promise<string> {
  const response: unknown = typeof error === 'object' && error !== null ? Reflect.get(error, 'context') : undefined;
  const body: unknown = response instanceof Response ? await response.json().catch(() => null) : null;
  const code: unknown = typeof body === 'object' && body !== null ? Reflect.get(body, 'code') : null;
  return typeof code === 'string' ? code : '';
}

function purgedFilesOf(data: unknown): PurgedFiles {
  const removed: unknown = typeof data === 'object' && data !== null ? Reflect.get(data, 'removed') : null;
  const left: unknown = typeof data === 'object' && data !== null ? Reflect.get(data, 'left') : null;
  return { removed: typeof removed === 'number' ? removed : 0, left: typeof left === 'number' ? left : 0 };
}

/**
 * Purges a live venue (#432), once its full archive with the KYC photos is saved and its name typed exactly: from the
 * console itself, so the database checks this computer. The rows deleted, in all.
 */
export function usePurgeLiveVenue(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ venueName }: { venueName: string }): Promise<Result<number, LivePurgeFailure>> => {
      const { data, error } = await client.rpc('purge_live_venue', { p_venue_id: venueId, p_venue_name: venueName });
      return error ? err(livePurgeFailureOf(error)) : ok(data.reduce((total, row) => total + row.deleted_rows, 0));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user', userId ?? 'signed-out'] }),
  });
}

// Kept here, not in queryKeys: only the Purge screen reads it.
const purgeFilesLeftKey = (userId: string, venueId: string) => ['user', userId, 'purgeFilesLeft', venueId] as const;

/** How many files the venue's latest purge still leaves, so the Purge screen offers them again when it opens. */
export function usePurgeFilesLeft(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: purgeFilesLeftKey(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<number> => {
      const { data, error } = await client.rpc('purge_files_left_count', { p_venue_id: venueId });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Removes the files a purge left (#432): those its archive held, through the purge-venue Edge Function, within seven
 * days of the purge. Asked again, it removes those that did not go the first time.
 */
export function useRemovePurgedFiles(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<Result<PurgedFiles, LivePurgeFailure>> => {
      const { data, error } = await client.functions.invoke('purge-venue', { body: { venueId } });
      return error ? err(livePurgeFailureOf({ code: await purgeCodeOf(error) })) : ok(purgedFilesOf(data));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: purgeFilesLeftKey(userId ?? 'signed-out', venueId) }),
  });
}
