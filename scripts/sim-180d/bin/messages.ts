import { runConsumer } from '@rivr/adapters';
import { createSimConsumers, type SentMessage } from '../src/messages/consumers.ts';
import { toRow } from '../src/messages/rows.ts';
import { createOutboxStore, createRpc } from '../src/messages/store.ts';
import type { StackStatus } from '../src/stack/status.ts';
import { sql } from './stack/psql.ts';

const BATCH = 20;
// A busy step (a promotion to every member) can hold hundreds of deliveries; claim until a batch comes back short.
const MAX_BATCHES = 100;

export interface Messenger {
  /** Runs every consumer at the simulation's time `at`, and writes what they sent to sim.message. */
  run(at: Date): Promise<{ delivered: number; failed: number }>;
}

function writeSent(messages: readonly SentMessage[]): void {
  if (messages.length === 0) return;
  const rows = JSON.stringify(messages.map(toRow)).replaceAll('$rows$', '');
  sql(`insert into sim.message (day, at, channel, consumer, recipient, member_id, kind, body, payload)
    select sim.day(), sim_clock.now(), r.channel, r.consumer, r.recipient, r.member_id, r.kind, r.body, r.payload
    from jsonb_to_recordset($rows$${rows}$rows$::jsonb)
      as r(channel text, consumer text, recipient text, member_id uuid, kind text, body text, payload jsonb)`);
}

export function createMessenger(status: StackStatus): Messenger {
  const rpc = createRpc(status.apiUrl, status.serviceRoleKey);
  const store = createOutboxStore(rpc);
  let now = new Date(0);
  const { consumers, sent } = createSimConsumers(rpc, () => now);
  return {
    async run(at) {
      now = at;
      const total = { delivered: 0, failed: 0 };
      for (const consumer of consumers) {
        for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
          const outcome = await runConsumer(store, consumer, BATCH);
          total.delivered += outcome.delivered;
          total.failed += outcome.failed;
          if (outcome.delivered + outcome.failed < BATCH) break;
        }
      }
      writeSent(sent.splice(0));
      return total;
    },
  };
}
