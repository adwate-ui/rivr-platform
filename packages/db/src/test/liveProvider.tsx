// The provider's tests' fake API and Realtime (provider.test.tsx, provider.member.test.tsx): a real client whose network is a
// fake database and whose channels a test fires itself.
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { vi } from 'vitest';
import type { RivrClient } from '../client.ts';
import type { Database } from '../database.types.ts';
import { useFeature } from '../hooks.ts';
import { sessionStorageFor, TEST_SESSION_KEY } from './session.ts';

export const ARJUN = '00000000-0000-4000-8000-000000000201';

/** What the fake API answers, changed by a test to stand in for a change in the database. */
export interface FakeDatabase {
  featureRows: { feature_key: string; state: string; tiers: string[] | null }[];
  rpcCalls: number;
  /** True while my_feature_access cannot be read. */
  featuresFail: boolean;
  /** The signed-in person's member rows, as the member app reads them. */
  memberIds?: string[];
  /** How many reads of them fail first, as with no network. */
  memberIdsFail?: number;
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

/** Answers the two requests the hooks make, as PostgREST would. */
function fakeFetch(database: FakeDatabase): typeof fetch {
  return async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes('/rest/v1/rpc/my_feature_access')) {
      database.rpcCalls += 1;
      if (database.featuresFail) return new Response(JSON.stringify({ message: 'unavailable' }), { status: 503 });
      return json(database.featureRows);
    }
    if (url.includes('/rest/v1/member?')) {
      if ((database.memberIdsFail ?? 0) > 0) {
        database.memberIdsFail = (database.memberIdsFail ?? 0) - 1;
        return new Response(JSON.stringify({ message: 'unavailable' }), { status: 503 });
      }
      return json((database.memberIds ?? []).map((id) => ({ id })));
    }
    return new Response('not found', { status: 404 });
  };
}

/** A real client whose network is the fake database, with Realtime held so tests fire changes. */
export function testClient(database: FakeDatabase, userId: string | null) {
  const client: RivrClient = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
    global: { fetch: fakeFetch(database) },
    auth: { storage: sessionStorageFor(userId), storageKey: TEST_SESSION_KEY, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const channels: RealtimeChannel[] = [];
  const openChannel = client.channel.bind(client);
  vi.spyOn(client, 'channel').mockImplementation((name, options) => {
    const channel = openChannel(name, options);
    vi.spyOn(channel, 'on');
    // No socket in tests: subscribing does nothing, and the test fires changes itself.
    vi.spyOn(channel, 'subscribe').mockReturnValue(channel);
    channels.push(channel);
    return channel;
  });
  return { client, channels };
}

/** Fires the handler the provider registered for changes to `table`, as Realtime would. */
export function fireChange(channel: RealtimeChannel, table: string) {
  const registration = vi.mocked(channel.on).mock.calls.find(([, filter]) => 'table' in filter && filter.table === table);
  const handler = registration?.[2];
  if (handler === undefined) throw new Error(`No handler for ${table}`);
  handler({ schema: 'public', table, commit_timestamp: '2026-10-18T00:00:00Z', eventType: 'UPDATE', new: {}, old: {}, errors: [] });
}

/** What a channel listens to: each table, and its filter or every row. */
export const heardOn = (channel: RealtimeChannel | undefined) =>
  vi.mocked(channel?.on)?.mock.calls.map(([, filter]) => ['table' in filter ? filter.table : '', 'filter' in filter ? filter.filter : 'every row']);

export function Probe() {
  const events = useFeature('events.book');
  return (
    <p>
      {`events: ${events.state}`}
    </p>
  );
}

export function freshDatabase(): FakeDatabase {
  return {
    featureRows: [{ feature_key: 'events.book', state: 'locked', tiers: ['Black card'] }],
    rpcCalls: 0,
    featuresFail: false,
  };
}
