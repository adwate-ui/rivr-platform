import { err, type Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';

/** One event a consumer claimed, to hand to its one adapter. */
export interface ClaimedDelivery {
  readonly deliveryId: string;
  readonly eventId: string;
  readonly venueId: string;
  readonly eventType: string;
  readonly payload: unknown;
  /** Which attempt this is, from 1 to MAX_ATTEMPTS. */
  readonly attempts: number;
  /** When the event happened, for a consumer whose message goes stale (#593). */
  readonly occurredAt?: Date;
}

/** Where deliveries come from and go back to: the database's claim and finish functions. */
export interface OutboxStore {
  claim(input: { consumer: string; eventTypes: readonly string[]; isMessaging: boolean; limit: number }): Promise<ClaimedDelivery[]>;
  /** `retryAfterSeconds` null fails the delivery for good: the vendor rejected it. */
  finish(input: { deliveryId: string; isDelivered: boolean; error: string | null; retryAfterSeconds: number | null }): Promise<void>;
}

/** A consumer: its name, the events it takes, and what it does with one of them. */
export interface Consumer {
  readonly name: string;
  readonly eventTypes: readonly string[];
  /** Messaging consumers hold while a messaging stop is engaged; Tally and ad events do not. */
  readonly isMessaging: boolean;
  deliver(delivery: ClaimedDelivery): Promise<Result<unknown, AdapterFailure>>;
}

/** Ten attempts, then the delivery fails for good and the owner is alerted (database side). */
export const MAX_ATTEMPTS = 10;

const SIX_HOURS = 6 * 60 * 60;

/** Seconds before a failed attempt is tried again: 1, 2, 4, 8 minutes and so on, at most six hours. */
export function backoffSeconds(attempts: number): number {
  return Math.min(60 * 2 ** Math.max(0, attempts - 1), SIX_HOURS);
}

function describe(failure: AdapterFailure): string {
  return failure.code === 'rejected' ? `rejected: ${failure.reason}` : failure.code;
}

/** When to try a failed delivery again: never for one the vendor rejected, else after its backoff. */
function retryAfter(failure: AdapterFailure, attempts: number): number | null {
  return failure.code === 'rejected' ? null : backoffSeconds(attempts);
}

/**
 * Runs one consumer once: claims its batch, hands each delivery to its adapter in turn, and finishes
 * each as delivered or failed with its backoff. A delivery that throws, at once or later, counts as
 * unavailable, and the rest of the batch carries on.
 */
export async function runConsumer(store: OutboxStore, consumer: Consumer, limit = 20): Promise<{ delivered: number; failed: number }> {
  const deliveries = await store.claim({ consumer: consumer.name, eventTypes: consumer.eventTypes, isMessaging: consumer.isMessaging, limit });
  let delivered = 0;
  for (const delivery of deliveries) {
    const outcome = await Promise.resolve()
      .then(() => consumer.deliver(delivery))
      .catch(() => err({ code: 'unavailable' } as const));
    if (outcome.ok) delivered += 1;
    await store.finish({
      deliveryId: delivery.deliveryId,
      isDelivered: outcome.ok,
      error: outcome.ok ? null : describe(outcome.error),
      retryAfterSeconds: outcome.ok ? 0 : retryAfter(outcome.error, delivery.attempts),
    });
  }
  return { delivered, failed: deliveries.length - delivered };
}
