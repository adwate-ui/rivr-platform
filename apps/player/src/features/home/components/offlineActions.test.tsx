import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type FloorTable, type MySeat, type WaitlistPlace } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JoinSheet } from './JoinSheet.tsx';
import { SeatReadyView } from './SeatReadyView.tsx';
import { SeatSheets } from './SeatSheets.tsx';
import { WaitingView } from './WaitingView.tsx';

const USER = '00000000-0000-4000-8000-000000000231';
const LATER = { timeout: 5000 };

const SEAT: MySeat = {
  tableName: 'Table 1', seat: 4, isAway: false, hasCallTime: true, callTimeLeft: 9668, playedSeconds: 1140, isLeaving: false, topUp: null,
  callTimeMinutes: 180, startedAt: '2026-11-15T16:55:30Z', callTimeEndsAt: null, tableTypeName: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n,
  timeRequestMinutes: null, addTimeChoices: [30, 60, 120],
};
const PLACE: WaitlistPlace = {
  entryId: 'e1', tableTypeId: 'tt1', tableTypeName: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n, joinedAt: '2026-11-15T17:14:00Z',
  place: 1, isRequest: false, callTableName: 'Table 1', callSeat: 4, holdUntil: '2026-11-15T17:34:00Z', awayUntil: null, tableId: 't1', tableName: 'Table 1',
  calledAt: '2026-11-15T17:14:00Z', onWayAt: null,
};
const TABLE: FloorTable = {
  id: 't1', venueId: 'v1', name: 'Table 1', isOpen: true, seats: 9, tableTypeId: 'tt1', tableTypeName: 'NLH 50/100', game: 'nlh', smallBlind: 5000n, bigBlind: 10000n,
  buyIn: 500000n, straddle: null, waiting: 0, callTimeMinutes: 180, openSeats: null, mustMoveToTableId: null, room: 'main',
};

/** A signed-in member whose tier has the waitlist, on a phone with no connection. */
function renderOffline(ui: ReactNode) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: USER, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async () => new Promise<Response>(() => undefined));
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  cache.setQueryData(['user', USER, 'feature-access'], new Map([['waitlist.join', { state: 'enabled' }]]));
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={cache}>
      <ToastProvider>{ui}</ToastProvider>
    </RivrDataProvider>,
  );
}

async function expectDisabled(name: string) {
  expect(await screen.findByRole('button', { name }, LATER)).toHaveProperty('disabled', true);
}

beforeEach(() => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'onLine');
});

// The seat or place may be one the phone only remembers, and a held request would act on whatever the member has by then.
describe('with no connection, nothing acts on a seat or a place (F-053)', () => {
  it('holds back a top-up', async () => {
    renderOffline(<SeatSheets open="topUp" seat={SEAT} secondsLeft={600} onClose={() => undefined} />);
    await expectDisabled('Request top-up');
  });

  it('holds back more time', async () => {
    renderOffline(<SeatSheets open="addTime" seat={SEAT} secondsLeft={600} onClose={() => undefined} />);
    await expectDisabled('Request 1 hour');
  });

  it('holds back leaving the seat', async () => {
    renderOffline(<SeatSheets open="leave" seat={SEAT} secondsLeft={600} onClose={() => undefined} />);
    await expectDisabled('Join leaving list');
  });

  it('holds back asking for a seat', async () => {
    renderOffline(<JoinSheet table={TABLE} onClose={() => undefined} />);
    await expectDisabled('Request a seat');
  });

  it('holds back both answers to a seat call', async () => {
    renderOffline(<SeatReadyView place={{ ...PLACE, holdUntil: '2026-11-15T17:34:00Z' }} now={new Date('2026-11-15T17:20:00Z')} />);
    await expectDisabled('Decline seat');
    await expectDisabled("I'm on my way");
  });

  it('holds back leaving the waitlist', async () => {
    renderOffline(<WaitingView place={PLACE} offer={null} />);
    await expectDisabled('Leave waitlist');
  });
});
