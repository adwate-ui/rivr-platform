# @rivr/offline

The one outbox for writes made offline, kept in IndexedDB so they survive a reload. The dealer tablet logs hands through it; any app that must write without a connection uses it too.

## Public API

| Export | What it does |
|---|---|
| `createOfflineQueue({ name, send, indexedDB?, retry?, schedule? })` | Opens the queue in the IndexedDB database `name`. `send` delivers one write and resolves `'sent'`, `'retry'` or `'rejected'`; a throw counts as `'retry'`. |
| `queue.enqueue(payload, idempotencyKey)` | Keeps the write, then starts sending. A key already queued is ignored, so a double tap lands once. |
| `queue.flush()` | Sends oldest first and stops at the first `'retry'`, so order is kept. A `'rejected'` write is parked and the writes behind it carry on. Resolves `{ sent, parked, pending }`. |
| `queue.pending()`, `queue.pendingCount()` | The writes waiting, oldest first (the tablet lists them as queued), and how many. |
| `queue.parked()` | The writes the server refused for good, oldest first, each with `rejectedAt`, for the app to show a supervisor. |
| `queue.discardParked(idempotencyKey)` | Forgets a parked write once a person has dealt with it. |
| `queue.subscribe(listener)` | Calls `listener(pending)` once the count is read, then on every change; returns an unsubscribe. |
| `queue.close()` | Stops retries and releases the database. Waiting and parked writes stay for the next open. |
| `retryDelay(failures, policy)`, `DEFAULT_RETRY` | The backoff: 1 s doubling to 60 s by default. |
| `OfflineQueue`, `OfflineQueueOptions`, `QueuedWrite`, `ParkedWrite`, `SendOutcome`, `FlushResult`, `RetryPolicy`, `Schedule` | Types. |

After a `'retry'` the queue retries on its own with the backoff, and starts over at the first delay once the queue empties.

`'retry'` is for anything that may succeed later: offline, a timeout, a server error. `'rejected'` is for a refusal that never will: a check violation, a hand for a closed table. Retrying those would block every hand behind them, so they are parked instead. A venue freeze is a `'retry'`: it lifts, and every hand behind it would be refused the same way meanwhile.

## Usage

```ts
import { createOfflineQueue } from '@rivr/offline';

const hands = createOfflineQueue<HandPayload>({
  name: 'tablet-hands',
  send: async ({ payload, idempotencyKey }) => {
    const result = await logHand(payload, idempotencyKey);
    if (result.ok) return 'sent';
    return result.isPermanent ? 'rejected' : 'retry';
  },
});

await hands.enqueue(hand, idempotencyKey); // the key is made once, when the dealer taps Log hand
hands.subscribe((pending) => setBanner(pending)); // "Offline. 3 hands queued."
const refused = await hands.parked(); // shown to the floor supervisor until each is resolved
```

## What the server must do

A write can reach the server and the tablet die before it hears back; after a reload the same write is sent again with the same key. The server's write function must treat a repeated idempotency key as success (`'sent'`), enforced by a unique constraint. That is what makes a replay land once.

## Must not

- Hold writes anywhere but this queue. One outbox per device, one way to replay.
- Make a new idempotency key on retry. The key belongs to the write, not to the attempt.
- Queue a payload that structured cloning cannot store (functions, class instances). Plain objects, bigints and Dates are fine.
