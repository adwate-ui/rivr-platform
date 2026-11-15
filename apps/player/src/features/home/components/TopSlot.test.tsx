import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import type { SeatStanding } from '@rivr/domain/notices';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TopSlot } from './TopSlot.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

// As my_notices gives them: the one that started last first.
const NOTICES = [
  { noticeId: 'n3', body: 'Open till 4 tonight.\nDetails: https://rivrpoker.com/launch', startsAt: '2026-11-15T14:00:00Z' },
  { noticeId: 'n2', body: 'Kitchen closes at 1 tonight.', startsAt: '2026-11-15T12:00:00Z' },
];
const CHECK = { photo_path: null, date_of_birth: null, masked_aadhaar: null, pan: null };
const AT_THE_DESK = { ...CHECK, status: 'started', at_club_from: '2026-11-05T09:00:00Z' };
const VERIFIED = { ...CHECK, status: 'verified', at_club_from: '2026-11-05T09:00:00Z' };
const BRING = 'Bring your Aadhaar and PAN on your first visit. The desk checks them before you play.';

/** A member signed in whose check reads `record`, with the club's notices in force and their seat as given. */
function renderSlot(record: unknown, seat: SeatStanding = 'none', notices = NOTICES) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000800', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-11-05T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    return Response.json(url.includes('/rest/v1/kyc_record') ? record : []);
  });
  return render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}>
      <TopSlot seat={seat} notices={notices} />
    </RivrDataProvider>,
  );
}

/** Long enough for the check to be read and the card, if any, to be drawn. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('Home › the one card above the offers (redesign RD-20)', () => {
  it('shows the ID check, and no notice, while the desk has not checked the member (decision 0502)', async () => {
    renderSlot(AT_THE_DESK);
    expect(await screen.findByText(BRING)).toBeDefined();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('article', { name: 'ID check' })).toBeDefined();
    expect(screen.queryByText('Kitchen closes at 1 tonight.')).toBeNull();
  });

  it('shows the one notice that started last once they are verified, in full with its links, and nothing to close it', async () => {
    renderSlot(VERIFIED, 'none', [...NOTICES].reverse());
    expect(await screen.findByRole('article', { name: 'From the club' })).toBeDefined();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText(/Open till 4 tonight\./)).toBeDefined();
    expect(screen.getByRole('link', { name: 'rivrpoker.com/launch' }).getAttribute('href')).toBe('https://rivrpoker.com/launch');
    expect(screen.queryByText('Kitchen closes at 1 tonight.')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows nothing for a verified member while no notice runs', async () => {
    const { container } = renderSlot(VERIFIED, 'none', []);
    await settled();
    expect(container.innerHTML).toBe('');
  });

  it.each(['called', 'taken'] as const)('shows neither while a seat is %s', async (seat) => {
    const verified = renderSlot(VERIFIED, seat);
    await settled();
    expect(verified.container.innerHTML).toBe('');
    cleanup();
    const unchecked = renderSlot(AT_THE_DESK, seat);
    await settled();
    expect(unchecked.container.innerHTML).toBe('');
  });
});
