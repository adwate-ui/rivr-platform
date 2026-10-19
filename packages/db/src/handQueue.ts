import type { HighHandCategory, HighHandRank } from '@rivr/contracts';
import type { Paise } from '@rivr/domain/money';
import { createOfflineQueue, type OfflineQueue, type QueuedWrite, type SendOutcome } from '@rivr/offline';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { RivrClient } from './client.ts';
import type { HandVariant } from './hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A hand the tablet keeps until the database has it (#43): what log_hand takes, and any high-hand claim with it. */
export interface QueuedHand {
  readonly pot: Paise;
  readonly variant: HandVariant;
  /** When Log hand was tapped: the hand keeps the rules in force then, however late it arrives. */
  readonly playedAt: string;
  readonly claim: { readonly seat: number; readonly category: HighHandCategory; readonly rank: HighHandRank | null } | null;
}

/**
 * The tablet's queue: the hands waiting to reach the database, oldest first; how many it refused for
 * good (for a supervisor); how many were held while offline and are still to land; and, once they
 * have, how many landed (null again when the next hand is logged), as the prototype says it.
 */
export interface HandQueueState {
  readonly queued: readonly QueuedHand[];
  readonly refused: number;
  readonly held: number;
  readonly sent: number | null;
}

const EMPTY: HandQueueState = { queued: [], refused: 0, held: 0, sent: null };

/** The state after the queue changes: hands held offline are counted, and reported once they have all landed. */
export function nextQueueState(before: HandQueueState, queued: readonly QueuedHand[], refused: number, isOnline: boolean): HandQueueState {
  if (!isOnline) return { queued, refused, held: Math.max(before.held, queued.length), sent: null };
  if (queued.length > 0) return { queued, refused, held: before.held, sent: null };
  return { queued, refused, held: 0, sent: before.held > 0 ? before.held : before.sent };
}

// Refusals that may pass later: the venue frozen or a switch off until it is released, a lost
// connection or a server error, a conflict worth trying again. Anything else is parked.
const TRY_AGAIN = new Set(['RVFRZ', 'RVKIL', '40001', '40P01', '57014']);

function outcomeOf(error: { code?: string }): SendOutcome {
  const code = error.code ?? '';
  return code === '' || code.startsWith('PGRST') || code.startsWith('08') || code.startsWith('53') || TRY_AGAIN.has(code) ? 'retry' : 'rejected';
}

/** Sends one queued hand: log_hand (a replay lands once, by its key), then its claim (replayed the same). */
async function sendHand(client: RivrClient, { payload: hand, idempotencyKey }: QueuedWrite<QueuedHand>): Promise<SendOutcome> {
  const logged = await client.rpc('log_hand', {
    p_pot: Number(hand.pot), p_variant: hand.variant, p_played_at: hand.playedAt, p_idempotency_key: idempotencyKey,
  });
  if (logged.error) return outcomeOf(logged.error);
  if (hand.claim === null) return 'sent';
  const claimed = await client.rpc('claim_high_hand', {
    p_hand_id: logged.data, p_seat: hand.claim.seat, p_category: hand.claim.category, p_rank: hand.claim.rank ?? '',
  });
  return claimed.error ? outcomeOf(claimed.error) : 'sent';
}

// One queue per client: every screen on the tablet logs through the same outbox, in order.
const QUEUES = new WeakMap<RivrClient, OfflineQueue<QueuedHand>>();

function handQueueFor(client: RivrClient): OfflineQueue<QueuedHand> {
  const known = QUEUES.get(client);
  if (known) return known;
  const queue = createOfflineQueue<QueuedHand>({ name: 'tablet-hands', send: (write) => sendHand(client, write) });
  QUEUES.set(client, queue);
  // Hands kept from before a reload (a power cut) go now, not with the next hand logged; and once
  // the connection is back, at once rather than at the next backoff.
  const resend = () => void queue.flush().catch(() => undefined);
  resend();
  window.addEventListener('online', resend);
  return queue;
}

/**
 * The dealer tablet's hands (#43): `log` keeps the hand on the tablet and sends it, oldest first,
 * now or once the connection is back, so hands keep logging offline and arrive in order once each.
 * The state lists what waits (`pending` counts it) and counts what was refused for good; the
 * down's hands reload as hands land.
 */
export function useHandQueue() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const queue = handQueueFor(client);
  const [state, setState] = useState<HandQueueState>(EMPTY);
  useEffect(() => queue.subscribe(() => {
    void Promise.all([queue.pending(), queue.parked()]).then(([waiting, parked]) => {
      setState((before) => nextQueueState(before, waiting.map((write) => write.payload), parked.length, navigator.onLine));
    });
    void queryClient.invalidateQueries({ queryKey: ['user', userId ?? 'signed-out', 'down-hands'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.tabletHighHands(userId ?? 'signed-out') });
  }), [queue, queryClient, userId]);
  const log = (hand: QueuedHand, requestId: string) => queue.enqueue(hand, requestId);
  return { log, pending: state.queued.length, ...state };
}
