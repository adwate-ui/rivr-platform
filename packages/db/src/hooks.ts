import type { FeatureKey, LearnSourceFeatureKey } from '@rivr/contracts';
import { useQuery } from '@tanstack/react-query';
import { NOTHING_ENGAGED, toControlState, type ControlState } from './parse/controlState.ts';
import { HIDDEN, toFeatureAccessMap, type FeatureAccess } from './parse/featureAccess.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/**
 * How a member-facing feature shows for the signed-in member: pass it to FeatureGate.
 * Hidden until known, so a locked entry point never flashes open.
 */
export function useFeature(key: FeatureKey | LearnSourceFeatureKey): FeatureAccess {
  const { client, userId } = useRivrData();
  const { data } = useQuery({
    queryKey: queryKeys.featureAccess(userId ?? 'signed-out'),
    enabled: userId !== null,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: rows, error } = await client.rpc('my_feature_access');
      if (error) throw error;
      return toFeatureAccessMap(rows);
    },
  });
  return data?.get(key) ?? HIDDEN;
}

/**
 * The kill-switch state for the banner and for disabling write controls. The database refuses
 * frozen writes whatever this returns; this only keeps the screen honest.
 */
export function useControlState(venueId?: string): ControlState {
  const { client, userId } = useRivrData();
  const { data } = useQuery({
    queryKey: queryKeys.controlState(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async () => {
      const { data: rows, error } = await client
        .from('control_state')
        .select('venue_id, level, feature, member_id, released_at')
        .is('released_at', null);
      if (error) throw error;
      return rows;
    },
  });
  return data ? toControlState(data, venueId) : NOTHING_ENGAGED;
}
