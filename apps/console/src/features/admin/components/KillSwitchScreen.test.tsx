import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KillSwitchScreen } from './KillSwitchScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const FREEZE = {
  control_id: 'c1', level: 'venue_freeze', feature: null, member_name: null, staff_name: null, reason: 'Dispute at Table 3',
  engaged_at: '2026-11-03T16:00:00+00:00', engaged_by: 'Neha Kulkarni', release_asked_by: null, release_reason: null,
};

/** A super admin on the kill switch with `engaged` engaged; every engage sent is kept. */
function renderKillSwitch(engaged: readonly unknown[], past: readonly unknown[] = []) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const engagedSent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/staff')) {
      return Response.json([{ id: 'st1', venue_id: 'v1', full_name: 'Vikram Rao', role: 'super_admin', venue: { name: 'RIVR Gurugram', is_practice: false } }]);
    }
    if (url.includes('/rpc/engaged_controls')) return Response.json(engaged);
    if (url.includes('/rpc/past_controls')) return Response.json(past);
    if (url.includes('/rpc/engage_control')) {
      engagedSent.push(JSON.parse(String(init?.body)));
      return Response.json('c2');
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider><KillSwitchScreen /></StaffVenueProvider>
    </RivrDataProvider>,
  );
  return engagedSent;
}

describe('Kill switch (console v3)', () => {
  it('keeps what has been released, by whom and why (F-034)', async () => {
    renderKillSwitch([], [{
      control_id: 'c9', level: 'venue_freeze', feature: null, member_name: null, staff_name: null, reason: 'Night 75 drill', engaged_at: '2026-11-03T16:00:00+00:00',
      engaged_by: 'Neha Kulkarni', released_at: '2026-11-03T18:00:00+00:00', released_by: 'Arvind Rao', release_second: 'Vikram Rao', release_reason: 'Drill over',
    }]);
    const row = (await screen.findByText('Night 75 drill', {}, { timeout: 5000 })).closest('[role="row"]');
    for (const shown of ['Venue freeze', 'Neha Kulkarni', 'Arvind Rao and Vikram Rao', 'Drill over']) expect(row?.textContent).toContain(shown);
  });

  it('filters past controls by the day they were engaged or released (decision 0512)', async () => {
    renderKillSwitch([], [{
      control_id: 'c9', level: 'venue_freeze', feature: null, member_name: null, staff_name: null, reason: 'Night 75 drill', engaged_at: '2026-11-03T16:00:00+00:00',
      engaged_by: 'Neha Kulkarni', released_at: '2026-11-03T18:00:00+00:00', released_by: 'Arvind Rao', release_second: 'Vikram Rao', release_reason: 'Drill over',
    }]);
    await screen.findByText('Night 75 drill', {}, { timeout: 5000 });
    for (const heading of ['Engaged', 'Released']) {
      fireEvent.click(screen.getByRole('button', { name: `${heading}: sort and filter` }));
      expect(await screen.findByRole('radio', { name: 'Last 7 days' })).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: `${heading}: sort and filter` }));
    }
  });

  it('says so when nothing has been released', async () => {
    renderKillSwitch([]);
    expect(await screen.findByText('Nothing has been released yet.', {}, { timeout: 5000 })).toBeDefined();
  });

  it('shows an engaged control as a red banner with Release', async () => {
    renderKillSwitch([FREEZE]);
    const release = await screen.findByRole('button', { name: 'Release Venue freeze' }, { timeout: 5000 });
    expect(release.textContent).toBe('Release');
    expect(release.closest('[role="status"]')?.className).toContain('bg-alert');
    fireEvent.click(release);
    expect(screen.getByRole('textbox', { name: 'Why it is released' })).toBeDefined();
  });

  it('gives each level a card saying what it does, read as the choice\u2019s description', async () => {
    renderKillSwitch([]);
    const level = await screen.findByRole('radio', { name: 'Messaging stop' }, { timeout: 5000 });
    const described = document.getElementById(level.getAttribute('aria-describedby') ?? '');
    expect(described?.textContent).toBe('Holds every message to members: WhatsApp, texts and notifications.');
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('engages only with a reason and a second, confirming press', async () => {
    const sent = renderKillSwitch([]);
    fireEvent.click(await screen.findByRole('radio', { name: 'Venue freeze' }, { timeout: 5000 }));
    fireEvent.click(screen.getByRole('button', { name: 'Engage' }));
    expect(await screen.findByText('Give a reason of 3 to 500 characters.')).toBeDefined();
    fireEvent.change(screen.getByRole('textbox', { name: 'Why' }), { target: { value: 'Dispute at Table 3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Engage' }));
    expect(await screen.findByText('Engage Venue freeze now?')).toBeDefined();
    expect(sent).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Engage Venue freeze' }));
    await waitFor(() => expect(sent).toEqual([{ p_venue_id: 'v1', p_level: 'venue_freeze', p_reason: 'Dispute at Table 3' }]));
  });
});
