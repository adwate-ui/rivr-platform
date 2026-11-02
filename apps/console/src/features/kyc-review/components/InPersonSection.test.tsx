import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InPersonSection } from './InPersonSection.tsx';

// jsdom has no camera, plays and draws nothing: the console's camera opens on a stand-in, and the photo comes back from
// the canvas as these bytes.
beforeEach(() => {
  vi.stubGlobal('isSecureContext', true);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => undefined }] }) } });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: () => Promise.resolve() });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:photo' });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined });
  vi.stubGlobal('createImageBitmap', async () => ({ width: 1200, height: 1600, close: () => undefined }));
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: () => ({ translate: () => undefined, scale: () => undefined, drawImage: () => undefined }) });
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) => done(new Blob(['jpeg'], { type: 'image/jpeg' })));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const NAINA = { member_id: '00000000-0000-4000-8000-000000000203', full_name: 'Naina Kapoor', phone_last4: '0203', status: null };

/** Vikram, a KYC reviewer, signed in, and a fake API that finds Naina and answers her check with `reply`. */
function renderSection(reply: () => Response) {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }),
  );
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/kyc_in_person_candidates')) return Response.json([NAINA]);
    if (url.includes('/functions/v1/kyc-in-person')) {
      sent.push(JSON.parse(String(init?.body)));
      return reply();
    }
    return Response.json([]);
  });
  const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
  render(<RivrDataProvider client={client}><InPersonSection venueId="v1" /></RivrDataProvider>);
  return sent;
}

/**
 * Finds Naina and fills in every detail from her originals, then verifies; the photo and her consent
 * unless a test leaves one out.
 */
async function checkNaina({ photo = true, consent = true } = {}) {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' }), { target: { value: 'nai' } });
  expect(await screen.findByText('Mobile ending 0203')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Check Naina Kapoor' }));
  if (photo) {
    // Taken with the console's camera, kept, never a file (K-07).
    fireEvent.click(screen.getByRole('button', { name: 'Take their photo' }));
    const take = await screen.findByRole('button', { name: 'Take photo' });
    await waitFor(() => expect(take.hasAttribute('disabled')).toBe(false));
    fireEvent.click(take);
    fireEvent.click(await screen.findByRole('button', { name: 'Use photo' }));
    await screen.findByRole('button', { name: 'Take the photo again' });
  }
  fireEvent.change(screen.getByLabelText('Date of birth on Naina Kapoor\'s original document'), { target: { value: '1990-04-12' } });
  fireEvent.change(screen.getByLabelText('Last four digits of Naina Kapoor\'s Aadhaar'), { target: { value: '1234' } });
  fireEvent.change(screen.getByLabelText('Naina Kapoor\'s PAN from the original card'), { target: { value: 'abcpn1234d' } });
  if (consent) fireEvent.click(screen.getByRole('switch', { name: 'Naina Kapoor agrees to this identity check' }));
  fireEvent.click(screen.getByRole('button', { name: 'Verify Naina Kapoor' }));
}

describe('a check in person', () => {
  it('sends the photo, the details from the originals and the consent, and says the member is verified', async () => {
    const sent = renderSection(() => Response.json({ status: 'verified' }));
    await checkNaina();
    expect(await screen.findByText('Naina Kapoor is verified and can take a seat.')).toBeDefined();
    expect(sent).toEqual([{
      memberId: NAINA.member_id, dateOfBirth: '1990-04-12', aadhaarLast4: '1234', pan: 'ABCPN1234D', consent: true, image: btoa('jpeg'),
    }]);
    expect(screen.queryByRole('button', { name: 'Verify Naina Kapoor' })).toBeNull();
  });

  it('says where the gate sent a check it did not verify', async () => {
    renderSection(() => Response.json({ status: 'refused' }));
    await checkNaina();
    expect(await screen.findByText('Naina Kapoor refused. See the checks below.')).toBeDefined();
    cleanup();
    renderSection(() => Response.json({ status: 'needs_review' }));
    await checkNaina();
    expect(await screen.findByText(/^Naina Kapoor goes to review/)).toBeDefined();
  });

  it('keeps the form, and says why, when the check did not go through', async () => {
    renderSection(() => Response.json({ error: 'not_allowed' }, { status: 403 }));
    await checkNaina();
    expect((await screen.findByRole('alert')).textContent).toMatch(/^Not allowed: reviewers only/);
    expect(screen.getByRole('button', { name: 'Verify Naina Kapoor' })).toBeDefined();
  });

  it('sends nothing without the member\'s consent, however complete the rest', async () => {
    const sent = renderSection(() => Response.json({ status: 'verified' }));
    await checkNaina({ consent: false });
    expect((await screen.findByRole('alert')).textContent).toMatch(/^Photo, date of birth/);
    expect(sent).toEqual([]);
  });

  it('sends nothing without the member\'s photo', async () => {
    const sent = renderSection(() => Response.json({ status: 'verified' }));
    await checkNaina({ photo: false });
    expect((await screen.findByRole('alert')).textContent).toMatch(/^Photo, date of birth/);
    expect(sent).toEqual([]);
  });
});
