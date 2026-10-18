import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOfflineQueue, type OfflineQueue, type QueuedWrite, type SendOutcome } from './index.ts';

interface Hand {
  readonly table: string;
  readonly pot: bigint;
}

/** A server that keeps one copy per idempotency key, as the database's unique constraint does. */
function fakeServer() {
  const attempts: string[] = [];
  const delivered: string[] = [];
  const kept = new Map<string, Hand>();
  const failing = new Set<string>();
  // Writes the database refuses for good, such as a check violation.
  const refusing = new Set<string>();
  return {
    attempts,
    delivered,
    kept,
    failing,
    refusing,
    isDown: false,
    async send(write: QueuedWrite<Hand>): Promise<SendOutcome> {
      attempts.push(write.idempotencyKey);
      if (this.isDown || failing.has(write.idempotencyKey)) return 'retry';
      if (refusing.has(write.idempotencyKey)) return 'rejected';
      delivered.push(write.idempotencyKey);
      if (!kept.has(write.idempotencyKey)) kept.set(write.idempotencyKey, write.payload);
      return 'sent';
    },
  };
}

/** Holds the retry the queue schedules, so a test decides when it runs. */
function manualScheduler() {
  const delays: number[] = [];
  let next: (() => void) | null = null;
  return {
    delays,
    schedule(run: () => void, delayMs: number) {
      delays.push(delayMs);
      next = run;
      return () => {
        next = null;
      };
    },
    runNext() {
      const run = next;
      next = null;
      run?.();
    },
  };
}

const hand = (pot: bigint): Hand => ({ table: 'Table 3', pot });

let indexedDB: IDBFactory;
let server: ReturnType<typeof fakeServer>;
let scheduler: ReturnType<typeof manualScheduler>;

function openQueue(): OfflineQueue<Hand> {
  return createOfflineQueue<Hand>({
    name: 'tablet-hands',
    send: (write) => server.send(write),
    indexedDB,
    schedule: (run, delayMs) => scheduler.schedule(run, delayMs),
    retry: { firstDelayMs: 1_000, maxDelayMs: 5_000 },
  });
}

beforeEach(() => {
  indexedDB = new IDBFactory();
  server = fakeServer();
  scheduler = manualScheduler();
});

describe('offline queue', () => {
  it('sends writes oldest first and empties the queue', async () => {
    const queue = openQueue();

    await queue.enqueue(hand(4_800_000n), 'hand-1');
    await queue.enqueue(hand(14_000_000n), 'hand-2');
    await queue.enqueue(hand(250_000n), 'hand-3');

    expect(await queue.flush()).toEqual({ sent: 0, parked: 0, pending: 0 });
    expect([...server.kept.keys()]).toEqual(['hand-1', 'hand-2', 'hand-3']);
    expect(server.kept.get('hand-1')).toEqual(hand(4_800_000n));
    expect(await queue.pendingCount()).toBe(0);
  });

  it('keeps one write per idempotency key, so a double tap lands once', async () => {
    server.isDown = true;
    const queue = openQueue();

    await queue.enqueue(hand(4_800_000n), 'hand-1');
    await queue.enqueue(hand(4_800_000n), 'hand-1');
    // Still down: this flush waits behind the ones the two taps started.
    expect(await queue.flush()).toEqual({ sent: 0, parked: 0, pending: 1 });

    server.isDown = false;
    expect(await queue.flush()).toEqual({ sent: 1, parked: 0, pending: 0 });
    expect(server.delivered).toEqual(['hand-1']);
  });

  it('stops at the first failure so later writes wait their turn', async () => {
    server.failing.add('hand-2');
    const queue = openQueue();

    await queue.enqueue(hand(100_000n), 'hand-1');
    await queue.enqueue(hand(200_000n), 'hand-2');
    await queue.enqueue(hand(300_000n), 'hand-3');
    expect(await queue.flush()).toEqual({ sent: 0, parked: 0, pending: 2 });
    expect(server.attempts).not.toContain('hand-3');

    server.failing.clear();
    expect(await queue.flush()).toEqual({ sent: 2, parked: 0, pending: 0 });
    expect([...server.kept.keys()]).toEqual(['hand-1', 'hand-2', 'hand-3']);
  });

  it('counts a send that throws as a failure to retry', async () => {
    const queue = createOfflineQueue<Hand>({
      name: 'tablet-hands',
      send: () => Promise.reject(new Error('network down')),
      indexedDB,
      schedule: (run, delayMs) => scheduler.schedule(run, delayMs),
    });

    await queue.enqueue(hand(100_000n), 'hand-1');

    expect(await queue.flush()).toEqual({ sent: 0, parked: 0, pending: 1 });
    expect(scheduler.delays.length).toBeGreaterThan(0);
  });

  it('retries on its own with a doubling, capped backoff, and starts over once it gets through', async () => {
    server.isDown = true;
    const queue = openQueue();

    await queue.enqueue(hand(100_000n), 'hand-1');
    await vi.waitFor(() => expect(scheduler.delays).toEqual([1_000]));
    for (const delays of [[1_000, 2_000], [1_000, 2_000, 4_000], [1_000, 2_000, 4_000, 5_000]]) {
      scheduler.runNext();
      await vi.waitFor(() => expect(scheduler.delays).toEqual(delays));
    }

    server.isDown = false;
    scheduler.runNext();
    await vi.waitFor(() => expect(server.kept.has('hand-1')).toBe(true));

    server.isDown = true;
    await queue.enqueue(hand(200_000n), 'hand-2');
    await vi.waitFor(() => expect(scheduler.delays.at(-1)).toBe(1_000));
  });

  it('tells subscribers how many writes are waiting, for "Offline. 3 hands queued."', async () => {
    server.isDown = true;
    const queue = openQueue();
    const counts: number[] = [];
    queue.subscribe((pending) => counts.push(pending));
    await vi.waitFor(() => expect(counts).toEqual([0]));

    await queue.enqueue(hand(100_000n), 'hand-1');
    await queue.enqueue(hand(200_000n), 'hand-2');
    await queue.enqueue(hand(300_000n), 'hand-3');
    expect(counts).toEqual([0, 1, 2, 3]);

    server.isDown = false;
    await queue.flush();
    expect(counts).toEqual([0, 1, 2, 3, 2, 1, 0]);
  });

  it('stops telling a subscriber once it unsubscribes', async () => {
    server.isDown = true;
    const queue = openQueue();
    const counts: number[] = [];
    const unsubscribe = queue.subscribe((pending) => counts.push(pending));
    await vi.waitFor(() => expect(counts).toEqual([0]));

    unsubscribe();
    await queue.enqueue(hand(100_000n), 'hand-1');

    expect(counts).toEqual([0]);
  });
});

describe('offline queue: writes the server refuses for good', () => {
  it('parks a refused write and sends the ones behind it', async () => {
    server.refusing.add('hand-2');
    const queue = openQueue();

    await queue.enqueue(hand(100_000n), 'hand-1');
    await queue.enqueue(hand(200_000n), 'hand-2');
    await queue.enqueue(hand(300_000n), 'hand-3');
    await queue.flush();

    expect([...server.kept.keys()]).toEqual(['hand-1', 'hand-3']);
    expect(await queue.pendingCount()).toBe(0);
    const parked = await queue.parked();
    expect(parked.map((write) => write.idempotencyKey)).toEqual(['hand-2']);
    expect(parked[0]?.payload).toEqual(hand(200_000n));
  });

  it('reports parked writes from a flush and keeps them across a reload', async () => {
    server.isDown = true;
    server.refusing.add('hand-1');
    const before = openQueue();
    await before.enqueue(hand(100_000n), 'hand-1');
    await before.enqueue(hand(200_000n), 'hand-2');
    expect(await before.flush()).toEqual({ sent: 0, parked: 0, pending: 2 });

    server.isDown = false;
    expect(await before.flush()).toEqual({ sent: 1, parked: 1, pending: 0 });
    before.close();

    const after = openQueue();
    expect((await after.parked()).map((write) => write.idempotencyKey)).toEqual(['hand-1']);
  });

  it('forgets a parked write once a person has dealt with it', async () => {
    server.refusing.add('hand-1');
    const queue = openQueue();
    await queue.enqueue(hand(100_000n), 'hand-1');
    await queue.flush();

    await queue.discardParked('hand-1');

    expect(await queue.parked()).toEqual([]);
  });
});

describe('offline queue across a reload', () => {
  it('keeps unsent writes when the app closes', async () => {
    server.isDown = true;
    const before = openQueue();
    await before.enqueue(hand(100_000n), 'hand-1');
    await before.enqueue(hand(200_000n), 'hand-2');
    before.close();

    const after = openQueue();
    expect(await after.pendingCount()).toBe(2);
  });

  it('loses nothing and duplicates nothing when the app dies in the middle of a flush', async () => {
    // The server stores hand-2, then the tablet dies before it hears back, so hand-2 is still queued.
    const crashing = createOfflineQueue<Hand>({
      name: 'tablet-hands',
      send: async (write) => {
        const outcome = await server.send(write);
        return write.idempotencyKey === 'hand-2' ? new Promise<SendOutcome>(() => undefined) : outcome;
      },
      indexedDB,
      schedule: (run, delayMs) => scheduler.schedule(run, delayMs),
    });
    await crashing.enqueue(hand(100_000n), 'hand-1');
    await crashing.enqueue(hand(200_000n), 'hand-2');
    await crashing.enqueue(hand(300_000n), 'hand-3');
    await vi.waitFor(() => expect(server.attempts).toContain('hand-2'));
    crashing.close();

    const reloaded = openQueue();
    expect(await reloaded.pendingCount()).toBe(2);
    expect(await reloaded.flush()).toEqual({ sent: 2, parked: 0, pending: 0 });

    expect(server.attempts).toEqual(['hand-1', 'hand-2', 'hand-2', 'hand-3']);
    expect([...server.kept.keys()]).toEqual(['hand-1', 'hand-2', 'hand-3']);
  });

  it('refuses new writes once closed', async () => {
    const queue = openQueue();
    queue.close();

    await expect(queue.enqueue(hand(100_000n), 'hand-1')).rejects.toThrow(/closed/);
    await expect(queue.flush()).rejects.toThrow(/closed/);
  });
});
