import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { SESSION_STORAGE_KEY, type RivrClient } from './client.ts';
import { readFailureCode, refusalCodeOf } from './failureCode.ts';
import { forgetOffline, keepForOffline, restoreForOffline } from './offlineCache.ts';
import { queryKeys } from './queryKeys.ts';

/** Whether anyone is signed in; `loading` until the stored session has been read. */
export type AuthStatus = 'loading' | 'signed-in' | 'signed-out';

/** Told of a failure a screen handles itself, by its short code (./failureCode.ts): never a value someone typed. */
export type FailureReport = (code: string) => void;

interface RivrData {
  readonly client: RivrClient;
  /** The signed-in user, or null before sign-in and while the session loads. */
  readonly userId: string | null;
  readonly authStatus: AuthStatus;
  /** The app's `onFailure`; does nothing in an app that gives none. */
  readonly reportFailure: FailureReport;
}

const reportNothing: FailureReport = () => undefined;

const RivrDataContext = createContext<RivrData | null>(null);

/** Which of a table's rows the member app hears (#903): all of them, the person's own member rows, or the rows of those members. */
type Heard = 'all' | 'user' | 'member';

// Tables whose changes alter what the signed-in person may do or holds, the cached query each one makes stale, and which
// rows the member app hears. Keys come from queryKeys, so renaming a key cannot silently stop live updates.
const TABLES_THAT_CHANGE_ACCESS: ReadonlyArray<readonly [table: string, staleQuery: (userId: string) => readonly string[], heard: Heard]> = [
  ['tier_feature', queryKeys.featureAccess, 'all'],
  ['member_feature_override', queryKeys.featureAccess, 'member'],
  ['member', queryKeys.featureAccess, 'user'],
  // Bonus chips given or used (decision 0504): the member's Bonus tab, the toast and the record's Bonus tab, each under its own row-level security.
  ['bonus_grant', queryKeys.bonusAll, 'member'],
  ['bonus_redemption', queryKeys.bonusAll, 'member'],
];

/** The member app's Realtime filter for a table: none for every row, or null while the person has no member row to hear. */
function ownRows(heard: Heard, userId: string, memberIds: readonly string[]): string | undefined | null {
  if (heard === 'all') return undefined;
  if (heard === 'user') return `user_id=eq.${userId}`;
  return memberIds.length === 0 ? null : `member_id=in.(${memberIds.join(',')})`;
}

/** The person's member rows, one for each venue they joined: what the member app's filters hear. A failed read throws, to be tried again. */
async function readMemberIds(client: RivrClient, userId: string): Promise<readonly string[]> {
  const { data, error } = await client.from('member').select('id').eq('user_id', userId).order('id');
  if (error) throw error;
  return data.map((row) => row.id);
}

interface Session {
  userId: string | null;
  authStatus: AuthStatus;
}

const LOADING: Session = { userId: null, authStatus: 'loading' };

/** Who the phone's stored session belongs to, whatever the age of its token: signed in, or still loading with none. */
function storedSession(): Session {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? 'null');
    if (typeof stored !== 'object' || stored === null || !('user' in stored)) return LOADING;
    const { user } = stored;
    return typeof user === 'object' && user !== null && 'id' in user && typeof user.id === 'string' ? { userId: user.id, authStatus: 'signed-in' } : LOADING;
  } catch {
    return LOADING;
  }
}

function useSession(client: RivrClient, keepsForOffline: boolean): Session {
  // Opened with no connection, the app that keeps a night knows whose it is at once: Auth takes half a minute to give up on a refresh.
  const [session, setSession] = useState<Session>(() => (keepsForOffline && !navigator.onLine ? storedSession() : LOADING));
  useEffect(() => {
    const signedInAs = (userId: string | null) => setSession({ userId, authStatus: userId === null ? 'signed-out' : 'signed-in' });
    // Auth failing outright to read the session (its lock, or the phone's storage) answers nothing, and nothing follows
    // it: go on as the stored session's member, as with no network, or as nobody with none stored, so the app never
    // loads for ever (redesign RD-34, decision 0641).
    const asStored = () => signedInAs(storedSession().userId);
    void client.auth.getSession().then(({ data, error }) => {
      // An expired session that cannot be refreshed for want of a network is not a sign-out: stay
      // loading, or for the app that keeps a night go on as the stored session's member (F-053), and
      // the refresh that follows when the network returns reports the session.
      if (isAuthRetryableFetchError(error)) {
        if (keepsForOffline) setSession(storedSession());
        return;
      }
      signedInAs(data.session?.user.id ?? null);
    }, asStored);
    const { data } = client.auth.onAuthStateChange((event, current) => {
      // getSession above reads the stored session; INITIAL_SESSION only repeats it (as null after a failed refresh).
      if (event === 'INITIAL_SESSION') return;
      signedInAs(current?.user.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, [client, keepsForOffline]);
  return session;
}

/**
 * One Realtime channel per app: a matrix, override, tier or Bonus change refreshes open screens. With `memberIds`, the member
 * app hears only the person's own rows (#903): a member who is also staff would otherwise get every change their staff role
 * may read, other members' names and Bonus among them.
 */
function useLiveUpdates(client: RivrClient, userId: string | null, memberIds?: readonly string[]): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (userId === null) return undefined;
    const channel = client.channel(`rivr-live-${userId}`);
    for (const [table, staleQuery, heard] of TABLES_THAT_CHANGE_ACCESS) {
      const filter = memberIds === undefined ? undefined : ownRows(heard, userId, memberIds);
      if (filter === null) continue;
      channel.on('postgres_changes', { event: '*', schema: 'public', table, ...(filter === undefined ? {} : { filter }) }, () => {
        void queryClient.invalidateQueries({ queryKey: staleQuery(userId) });
        if (memberIds !== undefined && heard === 'user') void queryClient.invalidateQueries({ queryKey: queryKeys.myMemberIds(userId) });
      });
    }
    channel.subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, queryClient, userId, memberIds]);
}

// A component only so the hook runs inside QueryClientProvider, where useQueryClient works.
function LiveUpdates({ client, userId }: Pick<RivrData, 'client' | 'userId'>) {
  useLiveUpdates(client, userId);
  return null;
}

/**
 * The member app's live updates (#903). The person's member rows are a query of their own: tried again when the read fails or
 * the network returns, and read again when one of them changes, as a sign-up makes the first. No channel opens until they are
 * known. Mounted only while someone is signed in, so a signed-out cache holds nothing of theirs.
 */
function OwnLiveUpdates({ client, userId }: { client: RivrClient; userId: string }) {
  const mine = useQuery({ queryKey: queryKeys.myMemberIds(userId), queryFn: () => readMemberIds(client, userId), staleTime: Infinity });
  useLiveUpdates(client, mine.data === undefined ? null : userId, mine.data);
  return null;
}

/**
 * A new cache, with what the phone kept when it opens offline (the installed player app, F-053). With `onFailure`, every
 * read that fails and every change the server refuses (`{ ok: false }`) is told to it by its code, whatever the screen shows.
 */
function newCache(keepsForOffline: boolean, onFailure: FailureReport | undefined): QueryClient {
  const cache = new QueryClient(onFailure ? {
    queryCache: new QueryCache({ onError: (error, query) => onFailure(readFailureCode(query.queryKey, error)) }),
    mutationCache: new MutationCache({
      onSuccess: (answer) => {
        const refusal = refusalCodeOf(answer);
        if (refusal !== null) onFailure(refusal);
      },
    }),
  } : {});
  if (keepsForOffline) restoreForOffline(cache);
  return cache;
}

/**
 * Gives everything below it the Supabase client and the query cache, and keeps access state live. `keepsForOffline`, the
 * player app: what it needs to open with no connection stays on the phone until sign-out (./offlineCache.ts). `onFailure`,
 * the player app (decision 0604): the failures its screens handle themselves, each by a short code. `ownRowsOnly`, the player
 * app (#903): live updates of the person's own rows only, never the venue's that a staff role would let them read.
 */
export function RivrDataProvider({ client, queryClient, keepsForOffline = false, ownRowsOnly = false, onFailure, children }: {
  client: RivrClient;
  queryClient?: QueryClient;
  keepsForOffline?: boolean;
  ownRowsOnly?: boolean;
  onFailure?: FailureReport;
  children: ReactNode;
}) {
  const [cache] = useState(() => queryClient ?? newCache(keepsForOffline, onFailure));
  const { userId, authStatus } = useSession(client, keepsForOffline);
  useEffect(() => (keepsForOffline && userId !== null ? keepForOffline(cache, userId) : undefined), [cache, keepsForOffline, userId]);
  useEffect(() => {
    if (keepsForOffline && authStatus === 'signed-out') forgetOffline();
  }, [authStatus, keepsForOffline]);
  return (
    <RivrDataContext.Provider value={{ client, userId, authStatus, reportFailure: onFailure ?? reportNothing }}>
      <QueryClientProvider client={cache}>
        {ownRowsOnly ? userId !== null && <OwnLiveUpdates client={client} userId={userId} /> : <LiveUpdates client={client} userId={userId} />}
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

/** How a screen reports a failure it handles itself and no read or change shows, such as a camera that would not start. */
export function useReportFailure(): FailureReport {
  return useRivrData().reportFailure;
}

/** Whether anyone is signed in, for an app deciding between sign-in and its screens. */
export function useAuthStatus(): AuthStatus {
  return useRivrData().authStatus;
}
