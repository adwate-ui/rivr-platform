import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { RivrClient } from './client.ts';
import { queryKeys } from './queryKeys.ts';

interface RivrData {
  readonly client: RivrClient;
  /** The signed-in user, or null before sign-in and while the session loads. */
  readonly userId: string | null;
}

const RivrDataContext = createContext<RivrData | null>(null);

// Tables whose changes alter what the signed-in person may do, and the cached query each one makes
// stale. Keys come from queryKeys, so renaming a key cannot silently stop live updates.
const TABLES_THAT_CHANGE_ACCESS: ReadonlyArray<readonly [table: string, staleQuery: (userId: string) => readonly string[]]> = [
  ['tier_feature', queryKeys.featureAccess],
  ['member_feature_override', queryKeys.featureAccess],
  ['member', queryKeys.featureAccess],
  ['control_state', queryKeys.controlState],
];

function useSessionUserId(client: RivrClient): string | null {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    void client.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data } = client.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  }, [client]);
  return userId;
}

/** One Realtime channel per app: a matrix, override, tier or kill-switch change refreshes open screens. */
function useLiveUpdates(client: RivrClient, userId: string | null): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (userId === null) return undefined;
    const channel = client.channel(`rivr-live-${userId}`);
    for (const [table, staleQuery] of TABLES_THAT_CHANGE_ACCESS) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        void queryClient.invalidateQueries({ queryKey: staleQuery(userId) });
      });
    }
    channel.subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, queryClient, userId]);
}

// A component only so the hook runs inside QueryClientProvider, where useQueryClient works.
function LiveUpdates({ client, userId }: RivrData) {
  useLiveUpdates(client, userId);
  return null;
}

/** Gives everything below it the Supabase client and the query cache, and keeps access state live. */
export function RivrDataProvider({ client, queryClient, children }: {
  client: RivrClient;
  queryClient?: QueryClient;
  children: ReactNode;
}) {
  const [cache] = useState(() => queryClient ?? new QueryClient());
  const userId = useSessionUserId(client);
  return (
    <RivrDataContext.Provider value={{ client, userId }}>
      <QueryClientProvider client={cache}>
        <LiveUpdates client={client} userId={userId} />
        {children}
      </QueryClientProvider>
    </RivrDataContext.Provider>
  );
}

/** The client and signed-in user. Using it outside RivrDataProvider is a bug. */
export function useRivrData(): RivrData {
  const data = useContext(RivrDataContext);
  if (data === null) throw new Error('useRivrData must be used inside RivrDataProvider');
  return data;
}
