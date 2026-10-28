import { err, ok, type Result } from '@rivr/contracts/result';
import { createOfflineQueue, type OfflineQueue, type SendOutcome } from '@rivr/offline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RivrClient } from './client.ts';
import type { Json } from './database.types.ts';
import { useRivrData } from './provider.tsx';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/learn).
const keys = {
  cards: (userId: string, sourceKey: string) => ['user', userId, 'learn-cards', sourceKey] as const,
  library: (userId: string) => ['user', userId, 'learn-library'] as const,
  encoding: (userId: string, sourceKey: string) => ['user', userId, 'learn-encoding', sourceKey] as const,
  answers: (userId: string, sourceKey: string) => ['user', userId, 'learn-answers', sourceKey] as const,
};

/** One answer as the app keeps it for the server (#132): its own id, so a resend is the same answer, and @rivr/drills' attempt row. */
export interface LearnAnswer {
  readonly id: string;
  readonly sessionId: string;
  readonly sourceKey: string;
  readonly principleId: string;
  readonly answeredAt: string;
  readonly attempt: { readonly [key: string]: Json | undefined };
}

/** A member's FSRS card for one spot: its state as @rivr/drills keeps it, and when it is next due. */
export interface LearnCard {
  readonly sourceKey: string;
  readonly cardKey: string;
  readonly state: { readonly [key: string]: Json | undefined };
  readonly dueAt: string;
}

/** What one write to the server carries: answers and the cards they moved, and the session completed with them. */
export interface LearnProgress {
  readonly answers: readonly LearnAnswer[];
  readonly cards: readonly LearnCard[];
  /** A session finished with these answers, and the principles the member mastered in it (#135). */
  readonly completed?: { readonly sessionId: string; readonly principles: readonly string[] } | undefined;
}

/** Why a session was not completed: no Learn drills, no answers kept, a freeze, or anything else. */
export type LearnFailure = 'not_allowed' | 'invalid' | 'paused' | 'unavailable';
const FAILURE_BY_CODE: Readonly<Record<string, LearnFailure>> = { '42501': 'not_allowed', '22023': 'invalid', RVFRZ: 'paused', RVMBR: 'paused' };

/** What a refusal means for a queued write: never passes (no Learn drills, malformed), or may pass later. */
const outcomeOf = (error: { code: string }): SendOutcome => (error.code === '42501' || error.code === '22023' ? 'rejected' : 'retry');

/**
 * Sends one queued write of Learn progress, then completes its session if it carries one: 'sent'; 'rejected' for a
 * refusal that never passes; 'retry' for anything that may pass later (offline, a freeze, a server error). Both
 * calls are idempotent, so a retry repeats them safely.
 */
export async function sendLearnProgress(client: RivrClient, progress: LearnProgress): Promise<SendOutcome> {
  const { error } = await client.rpc('sync_learn_progress', {
    p_attempts: progress.answers.map((answer) => ({
      id: answer.id, session_id: answer.sessionId, source_key: answer.sourceKey, principle_id: answer.principleId, answered_at: answer.answeredAt,
      attempt: answer.attempt,
    })),
    p_cards: progress.cards.map((card) => ({ source_key: card.sourceKey, card_key: card.cardKey, state: card.state, due_at: card.dueAt })),
  });
  if (error) return outcomeOf(error);
  if (progress.completed === undefined) return 'sent';
  const completed = await client.rpc('complete_learn_session', { p_session_id: progress.completed.sessionId, p_principles: [...progress.completed.principles] });
  return completed.error ? outcomeOf(completed.error) : 'sent';
}

// One queue per client, as the tablet's hands: every Learn screen writes through the same outbox, in order.
const QUEUES = new WeakMap<RivrClient, OfflineQueue<LearnProgress>>();

function learnQueueFor(client: RivrClient): OfflineQueue<LearnProgress> {
  const known = QUEUES.get(client);
  if (known) return known;
  const queue = createOfflineQueue<LearnProgress>({ name: 'learn-progress', send: ({ payload }) => sendLearnProgress(client, payload) });
  QUEUES.set(client, queue);
  // Progress kept from before a reload goes now, not with the next answer; and once the connection is back, at once.
  const resend = () => void queue.flush().catch(() => undefined);
  resend();
  window.addEventListener('online', resend);
  return queue;
}

/**
 * The device's queue of Learn progress (#132): kept in IndexedDB while offline, sent in order now, after a reload and
 * once the connection is back. Enqueue each answer with its card under the answer's id, and a finished session with
 * its last answers under the session's id, so its points are earned even when it ends offline.
 */
export function useLearnProgressQueue(): OfflineQueue<LearnProgress> {
  const { client } = useRivrData();
  return learnQueueFor(client);
}

/** The member's cards for one source, as the server last kept them (learn.drills). */
export function useLearnCards(sourceKey: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.cards(userId ?? 'signed-out', sourceKey),
    enabled: userId !== null,
    queryFn: async (): Promise<LearnCard[]> => {
      const { data, error } = await client.from('learn_card').select('source_key, card_key, state, due_at').eq('source_key', sourceKey);
      if (error) throw error;
      return data.map((row) => ({
        sourceKey: row.source_key, cardKey: row.card_key, dueAt: row.due_at,
        state: typeof row.state === 'object' && row.state !== null && !Array.isArray(row.state) ? row.state : {},
      }));
    },
  });
}

/**
 * Completes a session once its answers are synced (#135): the points it earned, its own and each principle first
 * mastered in it, within the day's cap; completing it again gives the same. A Result, and what the member sees reloads.
 */
export function useCompleteLearnSession() {
  const { client } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    // Sent whether the browser says it is online or not: offline it fails, and the caller queues it.
    networkMode: 'always',
    mutationFn: async ({ sessionId, principles }: { sessionId: string; principles: readonly string[] }): Promise<Result<number, LearnFailure>> => {
      const { data, error } = await client.rpc('complete_learn_session', { p_session_id: sessionId, p_principles: [...principles] });
      await queryClient.invalidateQueries({ queryKey: ['user'] });
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(data);
    },
  });
}

/** A licensed source the member has (#133): its key, title and author, and the club whose folder keeps it. */
export interface LibrarySource {
  readonly sourceKey: string;
  readonly title: string;
  readonly author: string | null;
  readonly venueId: string;
}

/** The licensed sources the member's tier has, until each licence ends (learn.library). */
export function useLearnLibrary() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.library(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<LibrarySource[]> => {
      const { data, error } = await client.from('learn_source').select('source_key, title, author, venue_id').order('title');
      if (error) throw error;
      return data.map((row) => ({ sourceKey: row.source_key, title: row.title, author: row.author, venueId: row.venue_id }));
    },
  });
}

/** A source's encoding as text, for the drill engine in the app; read once, as it changes only with a new upload. */
export function useLearnEncoding(source: LibrarySource | undefined) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.encoding(userId ?? 'signed-out', source?.sourceKey ?? ''),
    enabled: userId !== null && source !== undefined,
    staleTime: Infinity,
    queryFn: async (): Promise<string> => {
      const { data, error } = await client.storage.from('learn-sources').download(`${source?.venueId ?? ''}/${source?.sourceKey ?? ''}.json`);
      if (error) throw error;
      return await data.text();
    },
  });
}

/** The member's answers in a source: how many in all, and the latest, each the attempt row the app kept (learn.drills). */
export interface LearnAnswers {
  readonly total: number;
  /** The latest answers, newest first, up to the server's page. */
  readonly latest: readonly Json[];
}

/** The member's answers in a source, for the hub's figures and the review. */
export function useLearnAnswers(sourceKey: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.answers(userId ?? 'signed-out', sourceKey),
    enabled: userId !== null,
    queryFn: async (): Promise<LearnAnswers> => {
      const { data, error, count } = await client.from('learn_attempt').select('attempt', { count: 'exact' }).eq('source_key', sourceKey)
        .order('answered_at', { ascending: false });
      if (error) throw error;
      return { total: count ?? data.length, latest: data.map((row) => row.attempt) };
    },
  });
}
