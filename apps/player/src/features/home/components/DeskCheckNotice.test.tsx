import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeskCheckNotice } from './DeskCheckNotice.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

/** A member signed in whose check reads `record`. */
function renderNotice(record: unknown) {
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
      <DeskCheckNotice />
    </RivrDataProvider>,
  );
}

const CHECK = { photo_path: null, date_of_birth: null, masked_aadhaar: null, pan: null };

describe('Tonight › the desk check (decision 0502)', () => {
  it('tells a member let in by their selfie what to bring on their first visit', async () => {
    renderNotice({ ...CHECK, status: 'started', at_club_from: '2026-11-05T09:00:00Z' });
    expect(await screen.findByText('Bring your Aadhaar and PAN on your first visit. The desk checks them before you play.')).toBeDefined();
    expect(screen.getByText('Identity check')).toBeDefined();
  });

  it('shows nothing once the desk has verified them', async () => {
    const { container } = renderNotice({ ...CHECK, status: 'verified', at_club_from: '2026-11-05T09:00:00Z' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container.textContent).toBe('');
  });
});
