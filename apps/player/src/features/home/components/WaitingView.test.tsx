import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type WaitlistPlace } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WaitingView } from './WaitingView.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const PLACE: WaitlistPlace = {
  entryId: 'e1', tableTypeId: 'tt1', tableTypeName: 'NLH 50/100', smallBlind: 5000n, bigBlind: 10000n, joinedAt: '2026-11-15T17:14:00Z',
  place: 1, isRequest: false, callTableName: null, callSeat: null, holdUntil: null, awayUntil: null, tableId: 't1', tableName: 'Table 1',
  calledAt: null, onWayAt: null,
};

const DESK_FIRST = 'Your ID is checked at the desk before you sit.';
const CALLED = 'The floor calls you on WhatsApp for your seat.';

/** A member signed in on their place, whose own check reads `record`. */
function renderPlace(record: unknown) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000418', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-11-05T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    return Response.json(url.includes('/rest/v1/kyc_record') ? record : []);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider><WaitingView place={PLACE} offer={null} /></ToastProvider>
    </RivrDataProvider>,
  );
}

const CHECK = { photo_path: null, date_of_birth: null, masked_aadhaar: null, pan: null };

describe('On the list (decision 0503)', () => {
  it('tells a member let in by their selfie that the desk checks their ID before they sit', async () => {
    renderPlace({ ...CHECK, status: 'started', at_club_from: '2026-11-14T10:00:00Z' });
    expect(await screen.findByText(DESK_FIRST)).toBeDefined();
    expect(screen.getByText('Next in line')).toBeDefined();
  });

  it('tells every member on a list how they hear their seat is ready (8 Nov audit, F-188)', async () => {
    renderPlace({ ...CHECK, status: 'verified', at_club_from: null });
    expect(await screen.findByText(CALLED)).toBeDefined();
  });

  it('says nothing of the desk once the member is verified', async () => {
    renderPlace({ ...CHECK, status: 'verified', at_club_from: '2026-11-14T10:00:00Z' });
    expect(await screen.findByText('Next in line')).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(DESK_FIRST)).toBeNull();
  });
});
