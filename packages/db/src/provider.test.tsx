import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useControlState, useFeature } from './hooks.ts';
import { RivrDataProvider } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const ARJUN = '00000000-0000-4000-8000-000000000201';

/** What the fake API answers, changed by a test to stand in for a change in the database. */
interface FakeDatabase {
  featureRows: { feature_key: string; state: string; tiers: string[] | null }[];
  controlRows: { venue_id: string; level: string; feature: string | null; member_id: string | null; released_at: null }[];
  rpcCalls: number;
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
      return json(database.featureRows);
    }
    if (url.includes('/rest/v1/control_state')) return json(database.controlRows);
    return new Response('not found', { status: 404 });
  };
}

/** A real client whose network is the fake database, with Realtime held so tests fire changes. */
function testClient(database: FakeDatabase, userId: string | null) {
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
function fireChange(channel: RealtimeChannel, table: string) {
  const registration = vi.mocked(channel.on).mock.calls.find(([, filter]) => 'table' in filter && filter.table === table);
  const handler = registration?.[2];
  if (handler === undefined) throw new Error(`No handler for ${table}`);
  handler({ schema: 'public', table, commit_timestamp: '2026-10-18T00:00:00Z', eventType: 'UPDATE', new: {}, old: {}, errors: [] });
}

function Probe() {
  const learn = useFeature('learn.library');
  const control = useControlState();
  return (
    <p>
      {`learn: ${learn.state}; frozen: ${String(control.isVenueFrozen)}`}
    </p>
  );
}

function freshDatabase(): FakeDatabase {
  return {
    featureRows: [{ feature_key: 'learn.library', state: 'locked', tiers: ['Black card'] }],
    controlRows: [],
    rpcCalls: 0,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('RivrDataProvider, useFeature and useControlState', () => {
  it('shows nothing and asks for nothing while signed out', async () => {
    const database = freshDatabase();
    const { client, channels } = testClient(database, null);

    render(
      <RivrDataProvider client={client}>
        <Probe />
      </RivrDataProvider>,
    );

    expect(await screen.findByText('learn: hidden; frozen: false')).toBeDefined();
    expect(database.rpcCalls).toBe(0);
    expect(channels).toEqual([]);
  });

  it('reads the signed-in member’s access and the engaged controls', async () => {
    const database = freshDatabase();
    database.controlRows = [{ venue_id: 'gurugram', level: 'venue_freeze', feature: null, member_id: null, released_at: null }];
    const { client } = testClient(database, ARJUN);

    render(
      <RivrDataProvider client={client}>
        <Probe />
      </RivrDataProvider>,
    );

    expect(await screen.findByText('learn: locked; frozen: true')).toBeDefined();
  });

  it('refreshes open screens when the tier matrix or the kill switch changes', async () => {
    const database = freshDatabase();
    const { client, channels } = testClient(database, ARJUN);
    render(
      <RivrDataProvider client={client}>
        <Probe />
      </RivrDataProvider>,
    );
    await screen.findByText('learn: locked; frozen: false');
    const [channel] = channels;
    if (channel === undefined) throw new Error('The provider opened no Realtime channel');

    database.featureRows = [{ feature_key: 'learn.library', state: 'enabled', tiers: null }];
    fireChange(channel, 'tier_feature');
    expect(await screen.findByText('learn: enabled; frozen: false')).toBeDefined();

    database.controlRows = [{ venue_id: 'gurugram', level: 'venue_freeze', feature: null, member_id: null, released_at: null }];
    fireChange(channel, 'control_state');
    expect(await screen.findByText('learn: enabled; frozen: true')).toBeDefined();
  });

  it('listens to every table that changes what a person may do', async () => {
    const { client, channels } = testClient(freshDatabase(), ARJUN);
    render(
      <RivrDataProvider client={client}>
        <Probe />
      </RivrDataProvider>,
    );
    await waitFor(() => expect(channels).toHaveLength(1));
    const tables = vi.mocked(channels[0]?.on)?.mock.calls.map(([, filter]) => ('table' in filter ? filter.table : undefined));

    expect(tables).toEqual(['tier_feature', 'member_feature_override', 'member', 'control_state']);
  });
});
