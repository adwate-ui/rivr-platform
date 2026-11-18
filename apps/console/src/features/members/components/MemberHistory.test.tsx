import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemberHistory } from './MemberHistory.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** Nakul's History: 754 minutes played since his last reset, and one visit; `asked` keeps each visits call's body. */
function renderHistory() {
  const asked: unknown[] = [];
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000104', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/member_hours_played')) return Response.json(754);
    if (url.includes('/rpc/member_visits')) {
      asked.push(JSON.parse(String(init?.body)));
      return Response.json([{ visit_id: 'v1', opened_at: '2026-11-17T14:00:00Z', closed_at: null, tables: 'Table 3', minutes_played: 190,
        call_time_met: true, left_early: false, leave_reasons: ['busted'] }]);
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemberHistory venueId="v1" memberId="m2" />
    </RivrDataProvider>,
  );
  return { asked };
}

describe('History, from the Door', () => {
  it('says the hours played since the last reset, then the last ten visits', async () => {
    const { asked } = renderHistory();
    expect(await screen.findByText('12 h 34 min')).toBeDefined();
    expect(screen.getByText('Hours played')).toBeDefined();
    expect(await screen.findByText(/Left: Busted/)).toBeDefined();
    expect(asked[0]).toMatchObject({ p_venue_id: 'v1', p_member_id: 'm2', p_limit: 10 });
  });
});
