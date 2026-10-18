import type { QueuedWrite } from '../types.ts';

/** A queued write as IndexedDB holds it, with the sequence number that orders the queue. */
export interface StoredWrite<Payload> extends QueuedWrite<Payload> {
  readonly sequence: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Checks a record read back from IndexedDB. The payload was written by the same queue with the same
 * type and cannot be checked generically, so it is trusted here, at the storage boundary.
 */
export function toStoredWrite<Payload>(value: unknown): StoredWrite<Payload> {
  if (
    !isRecord(value) ||
    typeof value.sequence !== 'number' ||
    typeof value.idempotencyKey !== 'string' ||
    !(value.enqueuedAt instanceof Date)
  ) {
    throw new Error('The offline queue holds a record it did not write');
  }
  return {
    sequence: value.sequence,
    idempotencyKey: value.idempotencyKey,
    enqueuedAt: value.enqueuedAt,
    payload: value.payload as Payload,
  };
}
