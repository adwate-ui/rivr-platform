import { err, ok, type Result } from '@rivr/contracts/result';
import { createOfflineQueue, type OfflineQueue, type SendOutcome } from '@rivr/offline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { RivrClient } from './client.ts';
import type { Json } from './database.types.ts';
import { useRivrData } from './provider.tsx';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/learn).
const keys = { cards: (userId: string, sourceKey: string) => ['user', userId, 'learn-cards', sourceKey] as const };

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

/** What one write to the server carries: answers and the cards they moved. */
export interface LearnProgress {
  readonly answers: readonly LearnAnswer[];
  readonly cards: readonly LearnCard[];
}

/** Why a session was not completed: no Learn drills, no answers kept, a freeze, or anything else. */
export type LearnFailure = 'not_allowed' | 'invalid' | 'paused' | 'unavailable';
const FAILURE_BY_CODE: Readonly<Record<string, LearnFailure>> = { '42501': 'not_allowed', '22023': 'invalid', RVFRZ: 'paused', RVMBR: 'paused' };

/**
 * Sends one queued write of Learn progress: 'sent'; 'rejected' for a refusal that never passes (no Learn drills, a
 * malformed answer); 'retry' for anything that may pass later (offline, a freeze, a server error).
 */
export async function sendLearnProgress(client: RivrClient, progress: LearnProgress): Promise<SendOutcome> {
  const { error } = await client.rpc('sync_learn_progress', {
    p_attempts: progress.answers.map((answer) => ({
      id: answer.id, session_id: answer.sessionId, source_key: answer.sourceKey, principle_id: answer.principleId, answered_at: answer.answeredAt,
      attempt: answer.attempt,
    })),
    p_cards: progress.cards.map((card) => ({ source_key: card.sourceKey, card_key: card.cardKey, state: card.state, due_at: card.dueAt })),
  });
  if (!error) return 'sent';
  return error.code === '42501' || error.code === '22023' ? 'rejected' : 'retry';
}

/**
 * The device's queue of Learn progress (#132): kept in IndexedDB while offline, sent in order once the connection is
 * back. Enqueue each answer with its card under the answer's id. Null until the queue has opened.
 */
export function useLearnProgressQueue(): OfflineQueue<LearnProgress> | null {
  const { client } = useRivrData();
  const [queue, setQueue] = useState<OfflineQueue<LearnProgress> | null>(null);
  useEffect(() => {
    const opened = createOfflineQueue<LearnProgress>({ name: 'learn-progress', send: ({ payload }) => sendLearnProgress(client, payload) });
    setQueue(opened);
    return () => { opened.close(); };
  }, [client]);
  return queue;
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
    mutationFn: async ({ sessionId, principles }: { sessionId: string; principles: readonly string[] }): Promise<Result<number, LearnFailure>> => {
      const { data, error } = await client.rpc('complete_learn_session', { p_session_id: sessionId, p_principles: [...principles] });
      await queryClient.invalidateQueries({ queryKey: ['user'] });
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(data);
    },
  });
}
