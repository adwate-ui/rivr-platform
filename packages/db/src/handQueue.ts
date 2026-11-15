import type { Paise } from '@rivr/domain/money';
import { createOfflineQueue, type OfflineQueue, type QueuedWrite, type SendOutcome } from '@rivr/offline';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import type { RivrClient } from './client.ts';
import type { HandVariant } from './hands.ts';
import { useRivrData } from './provider.tsx';

/** A hand the tablet keeps until the database has it (#43): what log_hand takes. */
export interface QueuedHand {
  readonly pot: Paise;
  readonly variant: HandVariant;
  /** When Log hand was tapped: the hand keeps the rules in force then, however late it arrives. */
  readonly playedAt: string;
}

/** What the tablet's queue holds: a hand. A tablet that queued a high-hand claim before claims went holds one still, which is let go. */
type TabletWrite = { readonly hand: QueuedHand } | { readonly claim: unknown };

/** What the queue holds and set aside, read from it. */
interface QueueContents {
  readonly queued: readonly QueuedHand[];
  readonly refusedHands: number;
}

/**
 * The tablet's queue: the hands waiting to reach the database, oldest first; hands refused for good
 * (for the floor); how many hands were held while offline and are
 * still to land; and, once they have, how many landed (null again when the next hand is logged).
 */
export interface HandQueueState extends QueueContents {
  readonly held: number;
  readonly sent: number | null;
}

const EMPTY: HandQueueState = { queued: [], refusedHands: 0, held: 0, sent: null };

/** The state after the queue changes: hands held offline are counted, and reported once they have all landed. */
export function nextQueueState(before: HandQueueState, now: QueueContents, isOnline: boolean): HandQueueState {
  if (!isOnline) return { ...now, held: Math.max(before.held, now.queued.length), sent: null };
  if (now.queued.length > 0) return { ...now, held: before.held, sent: null };
  return { ...now, held: 0, sent: before.held > 0 ? before.held : before.sent };
}

function contentsOf(waiting: readonly QueuedWrite<TabletWrite>[], parked: readonly QueuedWrite<TabletWrite>[]): QueueContents {
  const hands = (writes: readonly QueuedWrite<TabletWrite>[]) => writes.flatMap(({ payload }) => ('hand' in payload ? [payload.hand] : []));
  return { queued: hands(waiting), refusedHands: hands(parked).length };
}

// Refusals that may pass later: the venue frozen or a switch off until it is released, a lost
// connection or a server error, a conflict worth trying again. Anything else is parked.
const TRY_AGAIN = new Set(['RVFRZ', 'RVKIL', '40001', '40P01', '57014']);

function outcomeOf(error: { code?: string }): SendOutcome {
  const code = error.code ?? '';
  return code === '' || code.startsWith('PGRST') || code.startsWith('08') || code.startsWith('53') || TRY_AGAIN.has(code) ? 'retry' : 'rejected';
}

/** Sends a hand by log_hand (a replay lands once, by its key). */
async function sendHand(client: RivrClient, hand: QueuedHand, key: string): Promise<SendOutcome> {
  const logged = await client.rpc('log_hand', { p_pot: Number(hand.pot), p_variant: hand.variant, p_played_at: hand.playedAt, p_idempotency_key: key });
  return logged.error ? outcomeOf(logged.error) : 'sent';
}

// One queue per client: every screen on the tablet logs through the same outbox, in order.
const QUEUES = new WeakMap<RivrClient, OfflineQueue<TabletWrite>>();

function handQueueFor(client: RivrClient): OfflineQueue<TabletWrite> {
  const known = QUEUES.get(client);
  if (known) return known;
  const queue: OfflineQueue<TabletWrite> = createOfflineQueue<TabletWrite>({
    name: 'tablet-hands',
    send: ({ payload, idempotencyKey }) => ('hand' in payload ? sendHand(client, payload.hand, idempotencyKey) : Promise.resolve('sent')),
  });
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
 * The state lists the hands waiting (`pending` counts them) and what was refused
 * for good, which `clearRefused` forgets once the floor has seen it. The down's hands reload as hands land.
 */
export function useHandQueue() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const queue = handQueueFor(client);
  const [state, setState] = useState<HandQueueState>(EMPTY);
  const read = useCallback(async () => {
    const [waiting, parked] = await Promise.all([queue.pending(), queue.parked()]);
    setState((before) => nextQueueState(before, contentsOf(waiting, parked), navigator.onLine));
  }, [queue]);
  useEffect(() => queue.subscribe(() => {
    void read();
    void queryClient.invalidateQueries({ queryKey: ['user', userId ?? 'signed-out', 'down-hands'] });
  }), [queue, queryClient, userId, read]);
  const log = (hand: QueuedHand, requestId: string) => queue.enqueue({ hand }, requestId);
  const clearRefused = async () => {
    for (const write of await queue.parked()) await queue.discardParked(write.idempotencyKey);
    await read();
  };
  return { log, clearRefused, pending: state.queued.length, ...state };
}
