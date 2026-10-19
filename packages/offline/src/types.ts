/**
 * What `send` reports for one write: the server has it (a duplicate key counts), try again later
 * (offline, a timeout, a server error), or the server refused it for good (a check violation, a
 * frozen venue) and retrying would only block every write behind it.
 */
export type SendOutcome = 'sent' | 'retry' | 'rejected';

/** A write waiting in the queue. */
export interface QueuedWrite<Payload> {
  readonly idempotencyKey: string;
  readonly payload: Payload;
  readonly enqueuedAt: Date;
}

/** A write the server refused for good, kept for a supervisor to see and resolve. */
export interface ParkedWrite<Payload> extends QueuedWrite<Payload> {
  readonly rejectedAt: Date;
}

/** How long to wait between attempts: the first delay doubles after each failed attempt, up to the cap. */
export interface RetryPolicy {
  readonly firstDelayMs: number;
  readonly maxDelayMs: number;
}

/** Runs `run` after `delayMs` and returns a function that cancels it. */
export type Schedule = (run: () => void, delayMs: number) => () => void;

/** Settings for one queue. */
export interface OfflineQueueOptions<Payload> {
  /** The IndexedDB database to keep writes in, one per queue: `tablet-hands`. */
  readonly name: string;
  /** Delivers one write. A throw counts as 'retry'. The server must accept a repeated key as 'sent'. */
  readonly send: (write: QueuedWrite<Payload>) => Promise<SendOutcome>;
  /** The IndexedDB to use; the browser's by default. */
  readonly indexedDB?: IDBFactory;
  /** Backoff between automatic retries; 1 second doubling to 60 seconds by default. */
  readonly retry?: RetryPolicy;
  /** How retries are timed; `setTimeout` by default. */
  readonly schedule?: Schedule;
}

/** What one flush did: writes delivered, writes parked as refused, and writes still waiting. */
export interface FlushResult {
  readonly sent: number;
  readonly parked: number;
  readonly pending: number;
}

/** The outbox for writes made while offline. Payloads must survive structured cloning (bigint does). */
export interface OfflineQueue<Payload> {
  /** Keeps the write and starts sending. A key already in the queue is ignored, so a double tap lands once. */
  enqueue(payload: Payload, idempotencyKey: string): Promise<void>;
  /**
   * Sends waiting writes oldest first and stops at the first 'retry', so order is kept. A
   * 'rejected' write moves to the parked list and the writes behind it carry on.
   */
  flush(): Promise<FlushResult>;
  /** Writes the server refused for good, oldest first, for the app to show a supervisor. */
  parked(): Promise<readonly ParkedWrite<Payload>[]>;
  /** Forgets a parked write once a person has dealt with it. */
  discardParked(idempotencyKey: string): Promise<void>;
  /** The writes waiting, oldest first: what a screen lists as queued. */
  pending(): Promise<readonly QueuedWrite<Payload>[]>;
  /** How many writes are waiting. */
  pendingCount(): Promise<number>;
  /** Calls `listener` with the waiting count once it is read, then whenever it changes. Returns an unsubscribe. */
  subscribe(listener: (pending: number) => void): () => void;
  /** Stops retrying and releases the database. Writes still waiting are kept for the next open. */
  close(): void;
}
