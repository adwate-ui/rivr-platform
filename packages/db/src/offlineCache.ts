import { dehydrate, hydrate, onlineManager, type DehydratedState, type Query, type QueryClient } from '@tanstack/react-query';

const STORAGE_KEY = 'rivr.offline.v1';
/** A club night: what was kept longer ago than this says too little of tonight to show. */
const KEPT_FOR_MS = 12 * 60 * 60 * 1000;
/** One write for a burst of answers, as a screen's reads come in together. */
const SAVE_AFTER_MS = 1000;

/**
 * The third part of each person's query key (queryKeys.ts) for what an installed app needs to open with no connection:
 * who they are, that their identity check let them in, their tabs, card, and Home's tables, place, seat and notices.
 */
const KEPT = new Set<unknown>(['member', 'kyc-record', 'feature-access', 'membership-card', 'floor-tables', 'my-waitlist', 'my-seat', 'my-notices']);

/** Restored entries stay for as long as they may be shown: nothing reads Card on a long offline Home, and TanStack drops what nothing reads. */
const KEEP_RESTORED = { defaultOptions: { queries: { gcTime: KEPT_FOR_MS } } };

type KeptQuery = DehydratedState['queries'][number];

/** One member's listed answers: a session can end without signing out, leaving another's in the cache. */
const isKept = (query: Query, userId: string) => query.state.status === 'success' && query.queryKey[0] === 'user' && query.queryKey[1] === userId && KEPT.has(query.queryKey[2]);

/** Each answer's own age, as one saved again keeps the time it was read. */
const isRecent = (query: KeptQuery, now: number) => now - query.state.dataUpdatedAt <= KEPT_FOR_MS;

/** What may not lie on a phone, by the query it is in: the identity check's documents and the path to the selfie. */
const BLANKED: Readonly<Partial<Record<string, Readonly<Record<string, null>>>>> = {
  'kyc-record': { photoPath: null, dateOfBirth: null, maskedAadhaar: null, pan: null },
  'membership-card': { photoPath: null },
};

/** The answers as they may lie on a phone: what the app reads, and none of the documents behind it. */
function withoutDocuments(state: DehydratedState): DehydratedState {
  return {
    ...state,
    queries: state.queries.map((query) => {
      const { data } = query.state;
      const blanked = BLANKED[String(query.queryKey[2])];
      if (blanked === undefined || typeof data !== 'object' || data === null) return query;
      return { ...query, state: { ...query.state, data: { ...data, ...blanked } } };
    }),
  };
}

/** Money is a bigint in the cache and the member's tabs a Map, neither of which JSON can carry. */
function encode(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return { $bigint: value.toString() };
  return value instanceof Map ? { $map: [...value] } : value;
}

const isEntry = (value: unknown): value is [unknown, unknown] => Array.isArray(value) && value.length === 2;

function decode(_key: string, value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value;
  if ('$bigint' in value && typeof value.$bigint === 'string') return BigInt(value.$bigint);
  return '$map' in value && Array.isArray(value.$map) ? new Map(value.$map.filter(isEntry)) : value;
}

/** What an earlier launch kept for this member and this one has not read: the card, on a launch that never opened it. */
function keptEarlier(state: DehydratedState, userId: string): KeptQuery[] {
  const readNow = new Set(state.queries.map((query) => query.queryHash));
  return (read()?.state.queries ?? []).filter((query) => query.queryKey[1] === userId && !readNow.has(query.queryHash));
}

function save(queryClient: QueryClient, userId: string): void {
  const state = withoutDocuments(dehydrate(queryClient, { shouldDehydrateQuery: (query) => isKept(query, userId) }));
  const now = Date.now();
  try {
    const queries = [...state.queries, ...keptEarlier(state, userId)].filter((query) => isRecent(query, now));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { ...state, queries } }, encode));
  } catch {
    // Storage full or refused: the app simply opens as it would have with nothing kept.
  }
}

/** Keeps this member's listed answers on the phone as they come in, from then on; returns how to stop. */
export function keepForOffline(queryClient: QueryClient, userId: string): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success' || !isKept(event.query, userId)) return;
    clearTimeout(timer);
    timer = setTimeout(() => save(queryClient, userId), SAVE_AFTER_MS);
  });
  return () => {
    clearTimeout(timer);
    stop();
  };
}

interface Kept {
  state: DehydratedState;
}

/** What this module wrote; anything else in the slot, as from a future version, is treated as nothing kept. */
function isKeptState(value: unknown): value is Kept {
  return typeof value === 'object' && value !== null && 'state' in value && typeof value.state === 'object' && value.state !== null;
}

function read(): Kept | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null', decode);
    return isKeptState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Opened with no connection: tells TanStack so at once (it hears only of a change, never the state at launch, so its first
 * reads would fail rather than pause), and brings back each answer still under a club night old. Online the app reads
 * afresh and shows nothing old. What cannot be read is forgotten, never thrown while the app starts.
 */
export function restoreForOffline(queryClient: QueryClient, now = Date.now()): void {
  if (navigator.onLine) return;
  onlineManager.setOnline(false);
  const kept = read();
  if (kept === null) return;
  try {
    const queries = kept.state.queries.filter((query) => isRecent(query, now));
    if (queries.length === 0) forgetOffline();
    else hydrate(queryClient, { ...kept.state, queries }, KEEP_RESTORED);
  } catch {
    forgetOffline();
  }
}

/** Signed out: nothing of theirs stays on a phone someone else may pick up. */
export function forgetOffline(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing could be kept where storage is refused.
  }
}
