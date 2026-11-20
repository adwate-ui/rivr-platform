import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { expect, vi } from 'vitest';
import { InPersonSection } from './InPersonSection.tsx';
import { InPersonSheet } from './InPersonSheet.tsx';

/**
 * jsdom has no camera, plays and draws nothing: the console's camera opens on a stand-in, and the photo comes back from
 * the canvas as these bytes. For a test's `beforeEach`.
 */
export function stubCamera() {
  vi.stubGlobal('isSecureContext', true);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => undefined }] }) } });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: () => Promise.resolve() });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:photo' });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined });
  vi.stubGlobal('createImageBitmap', async () => ({ width: 1200, height: 1600, close: () => undefined }));
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: () => ({ translate: () => undefined, scale: () => undefined, drawImage: () => undefined, fillRect: () => undefined }) });
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) => done(new Blob(['jpeg'], { type: 'image/jpeg' })));
}

export const NAINA = { member_id: '00000000-0000-4000-8000-000000000203', full_name: 'Naina Kapoor', phone_last4: '0203', status: null, app_selfie_path: null, retake_kinds: [], retake_reasons: [] };

/** What the check's function answers: at once, or when a test lets it. */
type Reply = () => Response | Promise<Response>;

/** Vikram, a KYC reviewer, signed in, over a fake API; gives what was sent to the check. */
/** What claim_kyc_desk_check answers: claimed unless a test says otherwise, each time or in turn, at once or later. */
type ClaimReply = unknown[] | (() => unknown[] | Promise<unknown[]>);

/** Claimed for Vikram, as Start finds a member no one else is checking. */
export const CLAIMED = [{ status: 'claimed', staff_name: null, since: '2026-11-20T14:30:00Z' }];

/** A check's claims and the desk's list of who others are checking, for a test that needs them. */
interface Claims {
  claim?: ClaimReply;
  claims?: unknown[];
  /** Collects the members whose claim is let go. */
  released?: string[];
}

/** What the desk's claim calls answer (the owner, 20 Nov), noting each claim let go; an empty list for any other call. */
async function deskAnswer(url: string, init: RequestInit | undefined, claims: Claims): Promise<Response> {
  if (url.includes('/rpc/claim_kyc_desk_check')) return Response.json(typeof claims.claim === 'function' ? await claims.claim() : claims.claim ?? CLAIMED);
  if (url.includes('/rpc/release_kyc_desk_check')) claims.released?.push(String(Reflect.get(JSON.parse(String(init?.body)), 'p_member_id')));
  return Response.json(url.includes('/rpc/kyc_desk_claims') ? claims.claims ?? [] : []);
}

function renderOver(ui: ReactElement, reply: Reply, lists: { found: unknown; due: unknown[]; holder: unknown[]; covers?: boolean } & Claims) {
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
    if (url.includes('/rpc/kyc_in_person_candidates')) return Response.json([lists.found]);
    if (url.includes('/rpc/kyc_due_tonight')) return Response.json(lists.due);
    if (url.includes('/rpc/kyc_duplicate_holder')) return Response.json(lists.holder);
    // The Aadhaar bars: off unless a test turns them on (decision 0663).
    if (url.includes('/rpc/kyc_aadhaar_covers')) return Response.json(lists.covers ?? false);
    if (url.includes('/functions/v1/kyc-image-url')) return Response.json({ signedPath: '/object/sign/kyc/selfie.jpg?token=t' });
    if (url.includes('/functions/v1/kyc-in-person')) {
      sent.push(JSON.parse(String(init?.body)));
      return reply();
    }
    return deskAnswer(url, init, lists);
  });
  const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
  render(<RivrDataProvider client={client}>{ui}</RivrDataProvider>);
  return sent;
}

/** The check on its screen: the API finds `found` (Naina), lists `due` as due tonight and answers her check with `reply`. */
export function renderSection(reply: Reply, found: unknown = NAINA, due: unknown[] = [], holder: unknown[] = []) {
  return renderOver(<InPersonSection venueId="v1" />, reply, { found, due, holder });
}

/** The check on its screen, with what Start's claim answers and who others are checking (the owner, 20 Nov). */
export function renderSectionClaimed(reply: Reply, claims: Claims, due: unknown[] = []) {
  return renderOver(<InPersonSection venueId="v1" />, reply, { found: NAINA, due, holder: [], ...claims });
}

/** The same, with the venue's Aadhaar bars on (decision 0663); Naina unless `found` says otherwise. */
export function renderSectionWithBars(reply: Reply, found: unknown = NAINA) {
  return renderOver(<InPersonSection venueId="v1" />, reply, { found, due: [], holder: [], covers: true });
}

/** The check behind its button, in the console's sheet. */
export function renderSheet(reply: Reply) {
  return renderOver(<InPersonSheet venueId="v1" />, reply, { found: NAINA, due: [], holder: [] });
}

/** Searches for Naina and presses her Check. */
export async function chooseNaina() {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Member\'s name or the last digits of their number' }), { target: { value: 'nai' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Check Naina Kapoor' }));
}

/** One photo through its camera: the shutter once it is live, then Use photo. */
export async function takeAndUse(confirmBars = false) {
  const take = await screen.findByRole('button', { name: 'Take photo' });
  await waitFor(() => expect(take.hasAttribute('disabled')).toBe(false));
  fireEvent.click(take);
  if (confirmBars) fireEvent.click(await screen.findByRole('switch', { name: /^The bars hide/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Use photo' }));
}

/** From the Member step through the three photo steps to Details, each "Use photo" moving on; never a file (K-07). */
export async function takeThreePhotos() {
  fireEvent.click(await screen.findByRole('button', { name: 'Start the check' }));
  await screen.findByText('Photo 1 of 3');
  await takeAndUse();
  await screen.findByText('Photo 2 of 3');
  await takeAndUse();
  await screen.findByText('Photo 3 of 3');
  await takeAndUse();
  await screen.findByRole('button', { name: 'Verify Naina Kapoor' });
}

/** The details from Naina's originals, typed on the Details step. */
export function typeDetails() {
  fireEvent.change(screen.getByLabelText('Date of birth on Naina Kapoor\'s original document'), { target: { value: '1990-04-12' } });
  fireEvent.change(screen.getByLabelText('Last four digits of Naina Kapoor\'s Aadhaar'), { target: { value: '1234' } });
  fireEvent.change(screen.getByLabelText('Naina Kapoor\'s PAN from the original card'), { target: { value: 'abcpn1234d' } });
}
