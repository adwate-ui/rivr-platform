import { toStoredWrite, type StoredWrite } from './parse/stored-write.ts';
import type { QueuedWrite } from './types.ts';

const VERSION = 1;
const WRITES = 'writes';
const BY_KEY = 'by-idempotency-key';

/** The queue's IndexedDB storage: writes ordered by an auto-increment sequence, unique by idempotency key. */
export interface OutboxStore<Payload> {
  /** Stores a write; false when its key is already queued. */
  add(write: QueuedWrite<Payload>): Promise<boolean>;
  oldest(): Promise<StoredWrite<Payload> | undefined>;
  remove(sequence: number): Promise<void>;
  count(): Promise<number>;
  close(): void;
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function committed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
  });
}

function openDatabase(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  const request = factory.open(name, VERSION);
  request.onupgradeneeded = () => {
    const writes = request.result.createObjectStore(WRITES, { keyPath: 'sequence', autoIncrement: true });
    writes.createIndex(BY_KEY, 'idempotencyKey', { unique: true });
  };
  return result(request);
}

async function addWrite<Payload>(database: IDBDatabase, write: QueuedWrite<Payload>): Promise<boolean> {
  const transaction = database.transaction(WRITES, 'readwrite');
  const request = transaction.objectStore(WRITES).add(write);
  let isDuplicate = false;
  request.onerror = (event) => {
    if (request.error?.name !== 'ConstraintError') return;
    isDuplicate = true;
    // A repeated key is expected: keep the transaction alive instead of aborting it.
    event.preventDefault();
  };
  await committed(transaction);
  return !isDuplicate;
}

/** Opens (creating on first use) the IndexedDB database `name` for a queue. */
export function openOutboxStore<Payload>(factory: IDBFactory, name: string): OutboxStore<Payload> {
  const opening = openDatabase(factory, name);
  const store = async (mode: IDBTransactionMode) => (await opening).transaction(WRITES, mode).objectStore(WRITES);
  return {
    add: async (write) => addWrite(await opening, write),
    async oldest() {
      const [first]: unknown[] = await result((await store('readonly')).getAll(null, 1));
      return first === undefined ? undefined : toStoredWrite<Payload>(first);
    },
    async remove(sequence) {
      const writes = await store('readwrite');
      writes.delete(sequence);
      await committed(writes.transaction);
    },
    count: async () => result((await store('readonly')).count()),
    close: () => void opening.then((database) => database.close()),
  };
}
