import { AuthRetryableFetchError, createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SESSION_STORAGE_KEY, type RivrClient } from './client.ts';
import type { Database } from './database.types.ts';
import { useFeature, useFeatureStatus } from './hooks.ts';
import { RivrDataProvider, useAuthStatus, useRivrData } from './provider.tsx';
import { sessionStorageFor, TEST_SESSION_KEY } from './test/session.ts';

const ARJUN = '00000000-0000-4000-8000-000000000201';

/** What the fake API answers, changed by a test to stand in for a change in the database. */
interface FakeDatabase {
  featureRows: { feature_key: string; state: string; tiers: string[] | null }[];
  rpcCalls: number;
  /** True while my_feature_access cannot be read. */
  featuresFail: boolean;
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
  const events = useFeature('events.book');
  return (
    <p>
      {`events: ${events.state}`}
    </p>
  );
}

function freshDatabase(): FakeDatabase {
  return {
    featureRows: [{ feature_key: 'events.book', state: 'locked', tiers: ['Black card'] }],
    rpcCalls: 0,
    featuresFail: false,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function AuthProbe() {
  return <p>{`auth: ${useAuthStatus()}`}</p>;
}

describe('useAuthStatus', () => {
  it('is signed-in with a stored session, and signed-out without one', async () => {
    const signedIn = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
      auth: { storage: sessionStorageFor(ARJUN), storageKey: 'rivr-test-auth', autoRefreshToken: false, detectSessionInUrl: false },
    });
    render(<RivrDataProvider client={signedIn}><AuthProbe /></RivrDataProvider>);
    expect(await screen.findByText('auth: signed-in')).toBeDefined();
    cleanup();

    const signedOut = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
      auth: { storage: sessionStorageFor(null), storageKey: 'rivr-test-auth', autoRefreshToken: false, detectSessionInUrl: false },
    });
    render(<RivrDataProvider client={signedOut}><AuthProbe /></RivrDataProvider>);
    expect(await screen.findByText('auth: signed-out')).toBeDefined();
  });

  it('stays loading, not signed-out, when an expired session cannot be refreshed for want of a network', async () => {
    const offline = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
      global: { fetch: () => Promise.reject(new TypeError('Failed to fetch')) },
      auth: { storage: sessionStorageFor(ARJUN, Math.floor(Date.now() / 1000) - 60), storageKey: 'rivr-test-auth', autoRefreshToken: false, detectSessionInUrl: false },
    });
    render(<RivrDataProvider client={offline}><AuthProbe /></RivrDataProvider>);

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.getByText('auth: loading')).toBeDefined();
  });

  describe('in the app that keeps a night for offline (F-053)', () => {
    function WhoProbe() {
      const { authStatus, userId } = useRivrData();
      return <p>{`${authStatus} as ${userId ?? 'nobody'}`}</p>;
    }
    const unreachable = () => {
      const client = createClient<Database>('http://127.0.0.1:9', 'test-publishable-key', {
        auth: { storage: sessionStorageFor(null), storageKey: 'rivr-test-auth', autoRefreshToken: false, detectSessionInUrl: false },
      });
      vi.spyOn(client.auth, 'getSession').mockResolvedValue({ data: { session: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) });
      return client;
    };
    const STORED = JSON.stringify({ access_token: 'old', refresh_token: 'old', token_type: 'bearer', expires_in: 3600, expires_at: 1, user: { id: ARJUN } });
    afterEach(() => localStorage.clear());

    it('goes on as the stored session\u2019s member when its token cannot be refreshed for want of a network', async () => {
      localStorage.setItem(SESSION_STORAGE_KEY, STORED);
      render(<RivrDataProvider client={unreachable()} keepsForOffline><WhoProbe /></RivrDataProvider>);
      expect(await screen.findByText(`signed-in as ${ARJUN}`)).toBeDefined();
    });

    it.each([['nothing stored', null], ['a stored session it cannot read', 'not json'], ['one with no user', '{}']])('stays loading with %s', async (_name, stored) => {
      if (stored !== null) localStorage.setItem(SESSION_STORAGE_KEY, stored);
      render(<RivrDataProvider client={unreachable()} keepsForOffline><WhoProbe /></RivrDataProvider>);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.getByText('loading as nobody')).toBeDefined();
    });
  });
});

describe('RivrDataProvider and useFeature', () => {
  it('shows nothing and asks for nothing while signed out', async () => {
    const database = freshDatabase();
    const { client, channels } = testClient(database, null);

    render(
      <RivrDataProvider client={client}>
        <Probe />
      </RivrDataProvider>,
    );

    expect(await screen.findByText('events: hidden')).toBeDefined();
    expect(database.rpcCalls).toBe(0);
    expect(channels).toEqual([]);
  });

  it('reads the signed-in member’s access', async () => {
    const database = freshDatabase();
    const { client } = testClient(database, ARJUN);

    render(
      <RivrDataProvider client={client}>
        <Probe />
      </RivrDataProvider>,
    );

    expect(await screen.findByText('events: locked')).toBeDefined();
  });

  it('refreshes open screens when the tier matrix changes', async () => {
    const database = freshDatabase();
    const { client, channels } = testClient(database, ARJUN);
    render(
      <RivrDataProvider client={client}>
        <Probe />
      </RivrDataProvider>,
    );
    await screen.findByText('events: locked');
    const [channel] = channels;
    if (channel === undefined) throw new Error('The provider opened no Realtime channel');

    database.featureRows = [{ feature_key: 'events.book', state: 'enabled', tiers: null }];
    fireChange(channel, 'tier_feature');
    expect(await screen.findByText('events: enabled')).toBeDefined();
  });

  it('listens to every table that changes what a person may do or holds: access and Bonus', async () => {
    const { client, channels } = testClient(freshDatabase(), ARJUN);
    render(
      <RivrDataProvider client={client}>
        <Probe />
      </RivrDataProvider>,
    );
    await waitFor(() => expect(channels).toHaveLength(1));
    const tables = vi.mocked(channels[0]?.on)?.mock.calls.map(([, filter]) => ('table' in filter ? filter.table : undefined));

    expect(tables).toEqual(['tier_feature', 'member_feature_override', 'member', 'bonus_grant', 'bonus_redemption']);
  });
});

function StatusProbe() {
  const events = useFeatureStatus('events.book');
  if (events.status === 'error') return <button type="button" onClick={events.retry}>events: error</button>;
  return <p>{`events: ${events.status === 'ready' ? events.access.state : events.status}`}</p>;
}

describe('useFeatureStatus', () => {
  it('is loading until the member’s access is known, and an error with a retry when it cannot be read', async () => {
    const database = freshDatabase();
    database.featuresFail = true;
    const { client } = testClient(database, ARJUN);
    const noRetries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<RivrDataProvider client={client} queryClient={noRetries}><StatusProbe /></RivrDataProvider>);

    expect(screen.getByText('events: loading')).toBeDefined();
    const retry = await screen.findByRole('button', { name: 'events: error' });
    database.featuresFail = false;
    fireEvent.click(retry);
    expect(await screen.findByText('events: locked')).toBeDefined();
  });

  it('is known, and hidden, while signed out', async () => {
    const { client } = testClient(freshDatabase(), null);
    render(<RivrDataProvider client={client}><StatusProbe /></RivrDataProvider>);
    expect(await screen.findByText('events: hidden')).toBeDefined();
  });
});
