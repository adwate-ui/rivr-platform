import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PurgeScreen } from './PurgeScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

interface Venue {
  isFrozen: boolean;
  /** The open ask, by this super admin or another; none. */
  ask: 'mine' | 'other' | null;
}

/** A super admin on Purge at a live venue, frozen or not, with an ask or none. */
function renderPurge({ isFrozen, ask }: Venue) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/staff')) {
      return Response.json([{ id: 'st1', venue_id: 'v1', full_name: 'Ira Bansal', role: 'super_admin', venue: { name: 'E2E Room', is_practice: false } }]);
    }
    if (url.includes('/rest/v1/control_state')) {
      return Response.json(isFrozen ? [{ venue_id: 'v1', level: 'venue_freeze', feature: null, member_id: null, released_at: null }] : []);
    }
    if (url.includes('/rpc/open_purge_request')) {
      return Response.json(ask === null ? [] : [{ asked_at: '2026-11-03T16:00:00+00:00', asked_by: 'Dev Rao', reason: 'Closing the room', is_mine: ask === 'mine' }]);
    }
    return Response.json([]);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StaffVenueProvider><PurgeScreen /></StaffVenueProvider>
    </RivrDataProvider>,
  );
}

const stepsOf = async () => within(await screen.findByRole('list', { name: 'Steps to purge the venue' }, { timeout: 5000 })).getAllByRole('listitem');
const isDisabled = (step: HTMLElement | undefined, name: string) => within(step ?? document.body).getByRole('button', { name }).hasAttribute('disabled');

describe('Purge in numbered steps (console v3)', () => {
  it('asks for the freeze first, every later step disabled', async () => {
    renderPurge({ isFrozen: false, ask: null });
    const [freeze, ask, archive, purge] = await stepsOf();
    expect(freeze?.getAttribute('aria-current')).toBe('step');
    expect(within(freeze ?? document.body).getByRole('link', { name: 'Open Kill switch' }).getAttribute('href')).toBe('/kill-switch');
    expect(isDisabled(ask, 'Ask for the purge')).toBe(true);
    expect(isDisabled(archive, 'Make the archive')).toBe(true);
    expect(isDisabled(purge, 'Purge the venue')).toBe(true);
  });

  it('once frozen, asks for a second super admin’s ask, the archive still disabled', async () => {
    renderPurge({ isFrozen: true, ask: null });
    expect(await screen.findByRole('textbox', { name: 'Why the venue is purged' }, { timeout: 5000 })).toBeDefined();
    const [freeze, ask, archive] = await stepsOf();
    expect(freeze?.textContent).toContain('The venue is frozen.');
    expect(ask?.getAttribute('aria-current')).toBe('step');
    expect(isDisabled(archive, 'Make the archive')).toBe(true);
  });

  it('when this super admin asked, leaves the archive and the purge to another', async () => {
    renderPurge({ isFrozen: true, ask: 'mine' });
    expect(await screen.findByText(/^You asked for the purge at /, {}, { timeout: 5000 })).toBeDefined();
    const [, , archive, purge] = await stepsOf();
    expect(isDisabled(archive, 'Make the archive')).toBe(true);
    expect(isDisabled(purge, 'Purge the venue')).toBe(true);
  });

  it('when another asked, opens the archive, and keeps the purge disabled until the archive is saved', async () => {
    renderPurge({ isFrozen: true, ask: 'other' });
    expect(await screen.findByText(/^Dev Rao asked for the purge at /, {}, { timeout: 5000 })).toBeDefined();
    const [, , archive, purge] = await stepsOf();
    expect(archive?.getAttribute('aria-current')).toBe('step');
    expect(within(archive ?? document.body).getByRole('textbox', { name: 'Why the KYC photos go in the archive' })).toBeDefined();
    expect(isDisabled(purge, 'Purge the venue')).toBe(true);
    expect(screen.queryByRole('textbox', { name: 'Type the venue\'s name to purge it' })).toBeNull();
  });
});
