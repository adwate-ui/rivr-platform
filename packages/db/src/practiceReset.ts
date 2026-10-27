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

/** Why a purge did not go through: the venue not frozen, no saved archive, the practice venue, or a control naming a member. */
export type LivePurgeFailure = 'not_allowed' | 'practice' | 'not_frozen' | 'no_archive' | 'wrong_name' | 'held' | 'unavailable';

const PURGE_FAILURE_BY_CODE: Readonly<Record<string, LivePurgeFailure>> = {
  '42501': 'not_allowed', RVPRC: 'practice', RVNFZ: 'not_frozen', RVARC: 'no_archive', RVNAM: 'wrong_name',
  // foreign_key_violation: a kill-switch control, which a purge keeps, names a member the purge removes.
  '23503': 'held',
};

/** The failure a refused purge preview or purge stands for. */
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

/** Purges a live venue, once its full archive is saved and its name typed exactly; gives the rows deleted. */
export function usePurgeLiveVenue(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (venueName: string): Promise<Result<number, LivePurgeFailure>> => {
      const { data, error } = await client.rpc('purge_live_venue', { p_venue_id: venueId, p_venue_name: venueName });
      return error ? err(livePurgeFailureOf(error)) : ok(data.reduce((total, row) => total + row.deleted_rows, 0));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user', userId ?? 'signed-out'] }),
  });
}
