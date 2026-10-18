import { DEFAULT_RETRY, retryDelay } from './backoff.ts';
import type { StoredWrite } from './parse/stored-write.ts';
import { openOutboxStore, type OutboxStore } from './store.ts';
import type {
  FlushResult,
  OfflineQueue,
  OfflineQueueOptions,
  QueuedWrite,
  RetryPolicy,
  Schedule,
  SendOutcome,
} from './types.ts';

const scheduleWithTimer: Schedule = (run, delayMs) => {
  const timer = setTimeout(run, delayMs);
  return () => clearTimeout(timer);
};

class Outbox<Payload> implements OfflineQueue<Payload> {
  readonly #store: OutboxStore<Payload>;
  readonly #send: (write: QueuedWrite<Payload>) => Promise<SendOutcome>;
  readonly #retry: RetryPolicy;
  readonly #schedule: Schedule;
  readonly #listeners = new Set<(pending: number) => void>();
  // Flushes run one after another, so two never send the same write at once.
  #passes: Promise<unknown> = Promise.resolve();
  #failuresInARow = 0;
  #cancelRetry: (() => void) | null = null;
  #isClosed = false;

  constructor(options: OfflineQueueOptions<Payload>) {
    this.#store = openOutboxStore(options.indexedDB ?? globalThis.indexedDB, options.name);
    this.#send = options.send;
    this.#retry = options.retry ?? DEFAULT_RETRY;
    this.#schedule = options.schedule ?? scheduleWithTimer;
  }

  async enqueue(payload: Payload, idempotencyKey: string): Promise<void> {
    this.#assertOpen();
    const isAdded = await this.#store.add({ idempotencyKey, payload, enqueuedAt: new Date() });
    if (isAdded) await this.#notify();
    void this.flush().catch(() => this.#scheduleRetry());
  }

  async flush(): Promise<FlushResult> {
    this.#assertOpen();
    const pass = this.#passes.then(() => this.#drain());
    this.#passes = pass.catch(() => undefined);
    return pass;
  }

  pendingCount(): Promise<number> {
    return this.#store.count();
  }

  subscribe(listener: (pending: number) => void): () => void {
    this.#listeners.add(listener);
    void this.#store.count().then(listener);
    return () => this.#listeners.delete(listener);
  }

  close(): void {
    this.#isClosed = true;
    this.#cancelRetry?.();
    this.#listeners.clear();
    this.#store.close();
  }

  async #drain(): Promise<FlushResult> {
    this.#cancelRetry?.();
    let sent = 0;
    let oldest = await this.#store.oldest();
    while (oldest !== undefined) {
      if ((await this.#deliver(oldest)) === 'retry') return this.#afterFailure(sent);
      await this.#store.remove(oldest.sequence);
      sent += 1;
      await this.#notify();
      oldest = await this.#store.oldest();
    }
    this.#failuresInARow = 0;
    return { sent, pending: 0 };
  }

  async #deliver(write: StoredWrite<Payload>): Promise<SendOutcome> {
    try {
      return await this.#send({ idempotencyKey: write.idempotencyKey, payload: write.payload, enqueuedAt: write.enqueuedAt });
    } catch {
      return 'retry';
    }
  }

  async #afterFailure(sent: number): Promise<FlushResult> {
    this.#failuresInARow += 1;
    this.#scheduleRetry();
    return { sent, pending: await this.#store.count() };
  }

  #scheduleRetry(): void {
    if (this.#isClosed) return;
    this.#cancelRetry?.();
    this.#cancelRetry = this.#schedule(() => {
      this.#cancelRetry = null;
      if (!this.#isClosed) void this.flush().catch(() => this.#scheduleRetry());
    }, retryDelay(this.#failuresInARow, this.#retry));
  }

  async #notify(): Promise<void> {
    const pending = await this.#store.count();
    for (const listener of this.#listeners) listener(pending);
  }

  #assertOpen(): void {
    if (this.#isClosed) throw new Error('This offline queue is closed');
  }
}

/**
 * The one outbox for writes made offline, kept in IndexedDB so they survive a reload. The dealer
 * tablet logs hands through it: `createOfflineQueue({ name: 'tablet-hands', send })`.
 */
export function createOfflineQueue<Payload>(options: OfflineQueueOptions<Payload>): OfflineQueue<Payload> {
  return new Outbox(options);
}
