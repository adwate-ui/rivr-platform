import type { FeatureKey } from '@rivr/contracts';
import { useQuery } from '@tanstack/react-query';
import { HIDDEN, toFeatureAccessMap, type FeatureAccess } from './parse/featureAccess.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** The signed-in member's access to every feature, by key. */
function useFeatureAccessMap() {
  const { client, userId } = useRivrData();
  // Signed out, the query is disabled; 'signed-out' only gives the key a value.
  return useQuery({
    queryKey: queryKeys.featureAccess(userId ?? 'signed-out'),
    enabled: userId !== null,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: rows, error } = await client.rpc('my_feature_access');
      if (error) throw error;
      return toFeatureAccessMap(rows);
    },
  });
}

/**
 * How a member-facing feature shows for the signed-in member: pass it to FeatureGate.
 * Hidden until known, so a locked entry point never flashes open.
 */
export function useFeature(key: FeatureKey): FeatureAccess {
  return useFeatureAccessMap().data?.get(key) ?? HIDDEN;
}

/** A feature's access, or that it is not known yet. */
export type FeatureStatus =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retry: () => void }
  | { readonly status: 'ready'; readonly access: FeatureAccess };

/**
 * useFeature for a screen that shows something either way: it waits until access is known, rather than
 * showing the screen for no access and then switching.
 */
export function useFeatureStatus(key: FeatureKey): FeatureStatus {
  const { authStatus } = useRivrData();
  const query = useFeatureAccessMap();
  // A failed refresh keeps what was known.
  if (query.data !== undefined) return { status: 'ready', access: query.data.get(key) ?? HIDDEN };
  if (authStatus === 'signed-out') return { status: 'ready', access: HIDDEN };
  return query.isError ? { status: 'error', retry: () => void query.refetch() } : { status: 'loading' };
}

