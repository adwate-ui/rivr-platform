import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemberIdDocuments } from './MemberIdDocuments.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const PAN = {
  kind: 'pan', path: 'v1/m1/doc-pan-1.jpg', taken_at: '2026-11-09T18:00:00Z', taken_by: 'Rhea Kulkarni',
  covers_confirmed_by: null, retake_asked_at: null, retake_reason: null,
};
const AADHAAR = { ...PAN, kind: 'aadhaar_front', path: 'v1/m1/doc-aadhaar-1.jpg', covers_confirmed_by: 'Rhea Kulkarni' };

/** Vikram, a super admin, signed in, and a fake API that lists `rows` and counts each photo opened. */
function renderDocuments(rows: unknown, answer: () => Response = () => new Response(null, { status: 204 })) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const opened: unknown[] = [];
  const sentBack: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/member_kyc_documents')) return Response.json(rows);
    if (url.includes('/rpc/ask_kyc_document_retake')) {
      sentBack.push(JSON.parse(String(init?.body)));
      return answer();
    }
    if (url.includes('/functions/v1/kyc-image-url')) {
      opened.push(JSON.parse(String(init?.body)));
      return Response.json({ signedPath: '/object/sign/kyc/doc.jpg?token=t' });
    }
    return Response.json([]);
  });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={cache}>
      <MemberIdDocuments venueId="v1" memberId="m1" />
    </RivrDataProvider>,
  );
  return { opened, sentBack };
}

describe('MemberIdDocuments', () => {
  it('lists each photo and who took it, and fetches neither until one is opened, as each opening is audited', async () => {
    const { opened } = renderDocuments([AADHAAR, PAN]);
    expect(await screen.findByText('PAN card')).toBeDefined();
    expect(screen.getByText('Aadhaar front')).toBeDefined();
    expect(screen.getByText('Bars confirmed by Rhea Kulkarni')).toBeDefined();
    expect(screen.getAllByText(/^Taken .* by Rhea Kulkarni$/)).toHaveLength(2);
    expect(opened).toEqual([]);
  });

  it('opens only the photo asked for', async () => {
    const { opened } = renderDocuments([AADHAAR, PAN]);
    fireEvent.click(await screen.findByRole('button', { name: 'Open the PAN card' }));
    expect(await screen.findByRole('img', { name: 'PAN card' })).toBeDefined();
    expect(opened).toHaveLength(1);
    expect(JSON.stringify(opened[0])).toContain('doc-pan-1.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Hide the PAN card' }));
    expect(screen.queryByRole('img', { name: 'PAN card' })).toBeNull();
  });

  it('asks afresh each time a photo is opened, so each opening is audited', async () => {
    const { opened } = renderDocuments([PAN]);
    fireEvent.click(await screen.findByRole('button', { name: 'Open the PAN card' }));
    await screen.findByRole('img', { name: 'PAN card' });
    fireEvent.click(screen.getByRole('button', { name: 'Hide the PAN card' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open the PAN card' }));
    await waitFor(() => expect(opened).toHaveLength(2));
  });

  it('sends an opened photo back with the reason in words', async () => {
    const { sentBack } = renderDocuments([PAN]);
    fireEvent.click(await screen.findByRole('button', { name: 'Open the PAN card' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Why the PAN card needs taking again' }), { target: { value: '  Blurred  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send back' }));
    await waitFor(() => expect(sentBack).toEqual([{ p_member_id: 'm1', p_kind: 'pan', p_reason: 'Blurred' }]));
  });

  it('says why a photo could not be sent back', async () => {
    renderDocuments([PAN], () => Response.json({ code: '22023', message: 'no' }, { status: 400 }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open the PAN card' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Send back' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/^Say why in words/);
  });

  it('shows why a photo was sent back, and offers no second sending', async () => {
    renderDocuments([{ ...PAN, retake_asked_at: '2026-11-09T19:00:00Z', retake_reason: 'Blurred' }]);
    expect(await screen.findByText('Sent back: Blurred. Waiting for the desk.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open the PAN card' }));
    await screen.findByRole('img', { name: 'PAN card' });
    expect(screen.queryByRole('button', { name: 'Send back' })).toBeNull();
  });

  it('says when no photos are on file', async () => {
    renderDocuments([]);
    expect(await screen.findByText('No ID photos on file.')).toBeDefined();
  });
});
