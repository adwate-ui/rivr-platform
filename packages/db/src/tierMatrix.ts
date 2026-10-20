import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** How a feature shows when a tier lacks it: not at all, or locked with a notice. */
export type DisplayMode = 'hidden' | 'locked';

/** How a feature shows to a member of a tier with no override, as the database's feature_state decides. */
export type ShowsAs = 'enabled' | 'locked' | 'hidden';

/** One cell of the tier x feature matrix, as the Tiers screen reads it (#32). */
export interface TierCell {
  readonly isEnabled: boolean;
  readonly displayMode: DisplayMode;
  readonly showsAs: ShowsAs;
  /** The tiers that have the feature, by rank: what a locked notice names. */
  readonly tiersWithIt: readonly string[];
  /** The next change already saved for later, which can be withdrawn until then. */
  readonly next: { readonly cellId: string; readonly from: string; readonly isEnabled: boolean; readonly displayMode: DisplayMode } | null;
}

/** The venue's matrix: its tiers by rank, the gateable features, and a cell for each pair. */
export interface TierMatrix {
  readonly tiers: readonly { readonly tierId: string; readonly name: string }[];
  readonly features: readonly { readonly key: string; readonly name: string; readonly description: string }[];
  /** By `cellKey(tierId, featureKey)`. */
  readonly cells: ReadonlyMap<string, TierCell>;
}

/** A cell to save: on, or off and shown as locked or hidden. */
export interface TierCellChange {
  readonly tierId: string;
  readonly featureKey: string;
  readonly isEnabled: boolean;
  readonly displayMode: DisplayMode;
}

/** Why a save or a withdrawal did not go through: `in_past` is a date already gone (or a change already in force); `changed` is the matrix changed meanwhile (a tier retired, say). */
export type TierFailure = 'not_allowed' | 'in_past' | 'changed' | 'unavailable';

const TIER_FAILURE_BY_CODE: Readonly<Record<string, TierFailure>> = { '42501': 'not_allowed', RVPST: 'in_past', '22023': 'changed' };

/** The key of one cell in `TierMatrix.cells`. */
export function cellKey(tierId: string, featureKey: string): string {
  return `${tierId}|${featureKey}`;
}

interface MatrixRow {
  tier_id: string;
  tier_name: string;
  feature_key: string;
  feature_name: string;
  feature_description: string;
  is_enabled: boolean;
  display_mode: DisplayMode;
  shows_as: string;
  tiers_with_it: readonly string[];
  next_cell_id: string | null;
  next_from: string | null;
  next_is_enabled: boolean | null;
  next_display_mode: DisplayMode | null;
}

function showsAs(text: string): ShowsAs {
  return text === 'enabled' || text === 'locked' ? text : 'hidden';
}

function nextOf(row: MatrixRow): TierCell['next'] {
  if (row.next_cell_id === null || row.next_from === null || row.next_is_enabled === null || row.next_display_mode === null) return null;
  return { cellId: row.next_cell_id, from: row.next_from, isEnabled: row.next_is_enabled, displayMode: row.next_display_mode };
}

/** The matrix from tier_matrix's rows, which come by feature, then tier rank. */
export function toTierMatrix(rows: readonly MatrixRow[]): TierMatrix {
  const tiers = new Map<string, string>();
  const features = new Map<string, { key: string; name: string; description: string }>();
  const cells = new Map<string, TierCell>();
  for (const row of rows) {
    tiers.set(row.tier_id, row.tier_name);
    features.set(row.feature_key, { key: row.feature_key, name: row.feature_name, description: row.feature_description });
    cells.set(cellKey(row.tier_id, row.feature_key), {
      isEnabled: row.is_enabled, displayMode: row.display_mode, showsAs: showsAs(row.shows_as), tiersWithIt: row.tiers_with_it, next: nextOf(row),
    });
  }
  return { tiers: [...tiers].map(([tierId, name]) => ({ tierId, name })), features: [...features.values()], cells };
}

/** The venue's tier x feature matrix, for staff with tiers.manage; empty for anyone else. */
export function useTierMatrix(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tierMatrix(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<TierMatrix> => {
      const { data, error } = await client.rpc('tier_matrix', { p_venue_id: venueId });
      if (error) throw error;
      return toTierMatrix(data);
    },
  });
}

/**
 * What tier managers do on the Tiers screen: `schedule` a batch of cells from a moment (null is now, by
 * the database's clock), and `withdraw` a change not yet in force. Each is a Result, and reloads the matrix.
 */
export function useTierActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async <T>(value: T, error: { code: string } | null): Promise<Result<T, TierFailure>> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.tierMatrix(userId ?? 'signed-out', venueId) });
    return error ? err(TIER_FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(value);
  };
  const schedule = useMutation({
    mutationFn: async ({ cells, from }: { cells: readonly TierCellChange[]; from: string | null }) => {
      const payload = cells.map((cell) => ({ tier_id: cell.tierId, feature_key: cell.featureKey, is_enabled: cell.isEnabled, display_mode: cell.displayMode }));
      const { data, error } = await client.rpc('schedule_tier_cells', { p_venue_id: venueId, p_cells: payload, ...(from === null ? {} : { p_effective_from: from }) });
      return settle(data ?? 0, error);
    },
  });
  const withdraw = useMutation({
    mutationFn: async (cellId: string): Promise<Result<null, TierFailure>> => {
      const { data, error } = await client.from('tier_feature').delete().eq('id', cellId).select('id');
      const result = await settle(null, error);
      // A change already in force can't be withdrawn: the policy hides it, so nothing was deleted.
      return result.ok && (data ?? []).length === 0 ? err('in_past') : result;
    },
  });
  return { schedule, withdraw };
}
