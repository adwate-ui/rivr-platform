# @rivr/offline

The one outbox for writes made offline, kept in IndexedDB so they survive a reload. The dealer tablet logs hands through it; any app that must write without a connection uses it too.

## Public API

| Export | What it does |
|---|---|
| `createOfflineQueue({ name, send, indexedDB?, retry?, schedule? })` | Opens the queue in the IndexedDB database `name`. `send` delivers one write and resolves `'sent'` or `'retry'`; a throw counts as `'retry'`. |
| `queue.enqueue(payload, idempotencyKey)` | Keeps the write, then starts sending. A key already queued is ignored, so a double tap lands once. |
| `queue.flush()` | Sends oldest first and stops at the first failure, so order is kept. Resolves `{ sent, pending }`. |
| `queue.pendingCount()` | How many writes wait. |
| `queue.subscribe(listener)` | Calls `listener(pending)` once the count is read, then on every change; returns an unsubscribe. |
| `queue.close()` | Stops retries and releases the database. Waiting writes stay for the next open. |
| `retryDelay(failures, policy)`, `DEFAULT_RETRY` | The backoff: 1 s doubling to 60 s by default. |
| `OfflineQueue`, `OfflineQueueOptions`, `QueuedWrite`, `SendOutcome`, `FlushResult`, `RetryPolicy`, `Schedule` | Types. |

After a failure the queue retries on its own with the backoff, and starts over at the first delay once the queue empties.

## Usage

```ts
import { createOfflineQueue } from '@rivr/offline';

const hands = createOfflineQueue<HandPayload>({
  name: 'tablet-hands',
  send: async ({ payload, idempotencyKey }) => ((await logHand(payload, idempotencyKey)).ok ? 'sent' : 'retry'),
});

await hands.enqueue(hand, idempotencyKey); // the key is made once, when the dealer taps Log hand
hands.subscribe((pending) => setBanner(pending)); // "Offline. 3 hands queued."
```

## What the server must do

A write can reach the server and the tablet die before it hears back; after a reload the same write is sent again with the same key. The server's write function must treat a repeated idempotency key as success (`'sent'`), enforced by a unique constraint. That is what makes a replay land once.

## Must not

- Hold writes anywhere but this queue. One outbox per device, one way to replay.
- Make a new idempotency key on retry. The key belongs to the write, not to the attempt.
- Queue a payload that structured cloning cannot store (functions, class instances). Plain objects, bigints and Dates are fine.
