import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** How an override stands: in force, lifted early by a super admin, replaced by a newer one, or ended on its last day. */
export type OverrideStanding = 'in_force' | 'lifted' | 'replaced' | 'ended';

/** One member's feature override (#61): which feature, granted or taken away, why, until when, who set it, and how it stands. */
export interface FeatureOverride {
  readonly overrideId: string;
  readonly featureKey: string;
  readonly featureName: string;
  readonly isGranted: boolean;
  readonly reason: string;
  /** Its last club day (YYYY-MM-DD); null for good. */
  readonly until: string | null;
  readonly standing: OverrideStanding;
  readonly staffName: string | null;
  /** For one lifted early: who lifted it, and why. */
  readonly lift: { readonly by: string; readonly reason: string } | null;
}

/** A feature a tier or an override can gate. */
export interface GateableFeature {
  readonly key: string;
  readonly name: string;
}

/** An override to set: grant or take away one feature, with a reason and an optional last day. */
export interface OverrideOrder {
  readonly memberId: string;
  readonly featureKey: string;
  readonly isGranted: boolean;
  readonly reason: string;
  readonly until: string | null;
}

/** Why an override did not go through: not a super admin, no such member, a bad feature, reason or day, none in force to lift, the venue frozen. */
export type OverrideFailure = 'not_allowed' | 'no_member' | 'invalid' | 'not_in_force' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, OverrideFailure>> = { '42501': 'not_allowed', RVNOM: 'no_member', '22023': 'invalid', RVOVR: 'not_in_force', RVFRZ: 'paused' };

const STANDINGS: readonly OverrideStanding[] = ['in_force', 'lifted', 'replaced', 'ended'];

function standingOf(value: string): OverrideStanding {
  return STANDINGS.find((standing) => standing === value) ?? 'ended';
}

/** A member's overrides, newest first; for super admins only (members.override_features). */
export function useMemberFeatureOverrides(venueId: string, memberId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.memberFeatureOverrides(userId ?? 'signed-out', venueId, memberId),
    enabled: userId !== null,
    queryFn: async (): Promise<FeatureOverride[]> => {
      const { data, error } = await client.rpc('member_feature_overrides', { p_venue_id: venueId, p_member_id: memberId });
      if (error) throw error;
      return data.map((row) => ({
        overrideId: row.override_id, featureKey: row.feature_key, featureName: row.feature_name, isGranted: row.is_granted, reason: row.reason,
        until: row.until, standing: standingOf(row.standing), staffName: row.staff_name,
        lift: row.lifted_by === null || row.lift_reason === null ? null : { by: row.lifted_by, reason: row.lift_reason },
      }));
    },
  });
}

/** The features tiers and overrides gate, by name. */
export function useGateableFeatures() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.gateableFeatures(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<GateableFeature[]> => {
      const { data, error } = await client.from('feature').select('key, name').eq('is_gateable', true).order('name');
      if (error) throw error;
      return data.map((row) => ({ key: row.key, name: row.name }));
    },
  });
}

/** `set` grants or takes away a feature for a member; `lift` ends one in force, with a reason. Each a Result; each reloads the overrides. */
export function useFeatureOverrideActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async (error: { code: string } | null): Promise<Result<null, OverrideFailure>> => {
    await queryClient.invalidateQueries({ queryKey: ['user', userId ?? 'signed-out'] });
    return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
  };
  const set = useMutation({
    mutationFn: async (order: OverrideOrder) => settle((await client.rpc('set_feature_override', {
      p_venue_id: venueId, p_member_id: order.memberId, p_feature_key: order.featureKey, p_is_granted: order.isGranted, p_reason: order.reason,
      ...(order.until === null ? {} : { p_until: order.until }),
    })).error),
  });
  const lift = useMutation({
    mutationFn: async ({ overrideId, reason }: { overrideId: string; reason: string }) =>
      settle((await client.rpc('lift_feature_override', { p_venue_id: venueId, p_override_id: overrideId, p_reason: reason })).error),
  });
  return { set, lift };
}
