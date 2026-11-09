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
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: () => ({ translate: () => undefined, scale: () => undefined, drawImage: () => undefined, fillRect: () => undefined }) });
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) => done(new Blob(['jpeg'], { type: 'image/jpeg' })));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const NAINA = { member_id: '00000000-0000-4000-8000-000000000203', full_name: 'Naina Kapoor', phone_last4: '0203', status: null, app_selfie_path: null, retake_kinds: [], retake_reasons: [] };

/**
 * Vikram, a KYC reviewer, signed in, and a fake API that finds `found` (Naina), lists `due` as due tonight and answers her
 * check with `reply`.
 */
function renderSection(reply: () => Response, found: unknown = NAINA, due: unknown[] = []) {
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
    if (url.includes('/rpc/kyc_in_person_candidates')) return Response.json([found]);
    if (url.includes('/rpc/kyc_due_tonight')) return Response.json(due);
    if (url.includes('/functions/v1/kyc-image-url')) return Response.json({ signedPath: '/object/sign/kyc/selfie.jpg?token=t' });
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

/** One photo through its camera: the shutter once it is live, then Use photo. */
async function takeAndUse(confirmBars = false) {
  const take = await screen.findByRole('button', { name: 'Take photo' });
  await waitFor(() => expect(take.hasAttribute('disabled')).toBe(false));
  fireEvent.click(take);
  if (confirmBars) fireEvent.click(await screen.findByRole('switch', { name: /^The bars hide/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Use photo' }));
}

/** The three photos in the desk's order, each camera opening as the last photo is kept; never a file (K-07). */
async function takeThreePhotos() {
  fireEvent.click(screen.getByRole('button', { name: 'Take their photo' }));
  await takeAndUse();
  await screen.findByText('Photo 2 of 3');
  await takeAndUse();
  await screen.findByText('Photo 3 of 3');
  await takeAndUse(true);
  await screen.findByRole('button', { name: 'Take the photo again' });
}

/**
 * Finds Naina and fills in every detail from her originals, then verifies; the photos and her consent
 * unless a test leaves one out.
 */
async function checkNaina({ photo = true, consent = true } = {}) {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' }), { target: { value: 'nai' } });
  expect(await screen.findByText('Mobile ending 0203')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Check Naina Kapoor' }));
  if (photo) await takeThreePhotos();
  fireEvent.change(screen.getByLabelText('Date of birth on Naina Kapoor\'s original document'), { target: { value: '1990-04-12' } });
  fireEvent.change(screen.getByLabelText('Last four digits of Naina Kapoor\'s Aadhaar'), { target: { value: '1234' } });
  fireEvent.change(screen.getByLabelText('Naina Kapoor\'s PAN from the original card'), { target: { value: 'abcpn1234d' } });
  if (consent) fireEvent.click(screen.getByRole('switch', { name: 'Naina Kapoor agrees to this ID check' }));
  fireEvent.click(screen.getByRole('button', { name: 'Verify Naina Kapoor' }));
}

describe('a check in person', () => {
  it('sends the photo, the details from the originals and the consent, and says the member is verified', async () => {
    const sent = renderSection(() => Response.json({ status: 'verified' }));
    await checkNaina();
    expect(await screen.findByText('Naina Kapoor is verified and can take a seat.')).toBeDefined();
    expect(sent).toEqual([{
      memberId: NAINA.member_id, dateOfBirth: '1990-04-12', aadhaarLast4: '1234', pan: 'ABCPN1234D', consent: true, coversConfirmed: true,
      image: btoa('jpeg'), panImage: btoa('jpeg'), aadhaarImage: btoa('jpeg'),
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
    expect((await screen.findByRole('alert')).textContent).toMatch(/^All three photos/);
    expect(sent).toEqual([]);
  });

  it('marks a member whose selfie came in for the desk, and shows that selfie beside the camera (decision 0502)', async () => {
    renderSection(() => Response.json({ status: 'verified' }), {
      ...NAINA, status: 'started', app_selfie_path: `v1/${NAINA.member_id}/photo.jpg`,
    });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' }), { target: { value: 'nai' } });
    expect(await screen.findByText('Selfie taken in the app. Check their originals.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Check Naina Kapoor' }));
    expect(await screen.findByRole('img', { name: 'The selfie Naina Kapoor took in the app' })).toBeDefined();
  });

  it('says a check the app started and never finished, with no selfie for the desk', async () => {
    renderSection(() => Response.json({ status: 'verified' }), { ...NAINA, status: 'started' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' }), { target: { value: 'nai' } });
    expect(await screen.findByText('Started on the app, not finished.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Check Naina Kapoor' }));
    expect(screen.queryByRole('img', { name: 'The selfie Naina Kapoor took in the app' })).toBeNull();
  });

  it('lists who is due tonight before a name is typed, a check held for its PAN among them, and checks one from there (F-010, F-091)', async () => {
    renderSection(() => Response.json({ status: 'verified' }), NAINA, [{ ...NAINA, status: 'needs_pan' }]);
    expect(await screen.findByRole('heading', { name: 'Due tonight' })).toBeDefined();
    expect(await screen.findByText('Waiting for a PAN. Check their originals.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Check Naina Kapoor' }));
    expect(await screen.findByRole('button', { name: 'Take their photo' })).toBeDefined();
  });

  it('says when nobody is due, and leaves the list once a search starts', async () => {
    renderSection(() => Response.json({ status: 'verified' }));
    expect(await screen.findByText('No checks due tonight.')).toBeDefined();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' }), { target: { value: 'nai' } });
    expect(await screen.findByText('Mobile ending 0203')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Due tonight' })).toBeNull();
  });

  it('takes a photo again without losing what was typed, and goes back to the form when the others are there', async () => {
    renderSection(() => Response.json({ status: 'verified' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' }), { target: { value: 'nai' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Check Naina Kapoor' }));
    fireEvent.change(screen.getByLabelText('Last four digits of Naina Kapoor\'s Aadhaar'), { target: { value: '1234' } });
    await takeThreePhotos();
    expect(screen.getByRole('img', { name: 'PAN card of Naina Kapoor' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Take the PAN card again' }));
    await takeAndUse();
    await screen.findByRole('button', { name: 'Take the Aadhaar front again' });
    expect(screen.queryByText(/^Photo \d of 3$/)).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('Last four digits of Naina Kapoor\'s Aadhaar').value).toBe('1234');
  });

  it('asks only for the photo a super admin sent back, and sends it alone', async () => {
    const sent = renderSection(() => Response.json({ status: 'retaken' }), { ...NAINA, status: 'verified', retake_kinds: ['pan'], retake_reasons: ['Blurred'] });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' }), { target: { value: 'nai' } });
    expect(await screen.findByText('A photo was sent back. Take it again.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Check Naina Kapoor' }));
    expect(screen.queryByLabelText('Date of birth on Naina Kapoor\'s original document')).toBeNull();
    expect(await screen.findByText('Sent back: Blurred.')).toBeDefined();
    fireEvent.click(await screen.findByRole('button', { name: 'Photograph the PAN card' }));
    await takeAndUse();
    expect(await screen.findByText('New photo kept for Naina Kapoor.')).toBeDefined();
    expect(sent).toEqual([{ memberId: NAINA.member_id, kind: 'pan', coversConfirmed: false, image: btoa('jpeg') }]);
  });

  it('tells the desk why when a reopened check also has a photo sent back, and asks for the whole check', async () => {
    renderSection(() => Response.json({ status: 'verified' }), { ...NAINA, status: 'started', retake_kinds: ['aadhaar_front'], retake_reasons: ['Digits showing'] });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' }), { target: { value: 'nai' } });
    expect(await screen.findByText('A photo was sent back. Take it again.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Check Naina Kapoor' }));
    expect(await screen.findByText('Sent back: Digits showing.')).toBeDefined();
    expect(screen.getByLabelText('Date of birth on Naina Kapoor\'s original document')).toBeDefined();
  });

  it('keeps a sent-back photo owed, and says why, when it was not saved', async () => {
    renderSection(() => Response.json({ error: 'decided' }, { status: 409 }), { ...NAINA, status: 'verified', retake_kinds: ['pan'], retake_reasons: ['Blurred'] });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' }), { target: { value: 'nai' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Check Naina Kapoor' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Photograph the PAN card' }));
    await takeAndUse();
    expect((await screen.findByRole('alert')).textContent).toMatch(/^Already decided/);
    expect(screen.getByRole('button', { name: 'Photograph the PAN card' })).toBeDefined();
  });

  it('sends nothing without the member\'s photo', async () => {
    const sent = renderSection(() => Response.json({ status: 'verified' }));
    await checkNaina({ photo: false });
    expect((await screen.findByRole('alert')).textContent).toMatch(/^All three photos/);
    expect(sent).toEqual([]);
  });
});
