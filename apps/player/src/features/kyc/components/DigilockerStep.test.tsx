import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DigilockerStep } from './DigilockerStep.tsx';

/** Renders the DigiLocker step against a fake kyc function that answers every call with `reply`; gives the bodies it was sent. */
function renderStep(reply: { status: number; body: unknown }, isResume = true): unknown[] {
  const sent: unknown[] = [];
  vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof init?.body === 'string') sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } });
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}>
      <DigilockerStep isResume={isResume} />
    </RivrDataProvider>,
  );
  return sent;
}

/** Continue to DigiLocker once the check for documents already in has settled: it is busy until then. */
async function continueButton(): Promise<HTMLElement> {
  const button = screen.getByRole('button', { name: 'Continue to DigiLocker' });
  await vi.waitFor(() => expect(button.getAttribute('aria-busy')).toBeNull());
  return button;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Identity › Resume', () => {
  it('picks up at DigiLocker, the selfie done, with what DigiLocker asks (K-09, decision 0320)', () => {
    renderStep({ status: 200, body: {} });
    expect(screen.getByRole('list', { name: 'ID check' })).toBeDefined();
    expect(screen.getByText('Selfie').textContent).toBe('Selfie, done');
    expect(screen.getByText('DigiLocker').textContent).toBe('DigiLocker, current step');
    expect(screen.getByRole('heading', { name: 'Pick up where you left off' })).toBeDefined();
    expect(screen.getByText('Step 2 of 2')).toBeDefined();
    expect(screen.getByText('Aadhaar and OTP, then tick Aadhaar and PAN')).toBeDefined();
  });

  it('takes documents that came while the member was away before offering a new hand-off, which would drop them', async () => {
    const sent = renderStep({ status: 200, body: { status: 'waiting' } });
    await vi.waitFor(() => expect(sent).toContainEqual({ action: 'complete' }));
    expect(screen.getByRole('button', { name: 'Continue to DigiLocker' })).toBeDefined();
  });

  it('asks nothing straight after the selfie', async () => {
    const sent = renderStep({ status: 200, body: {} }, false);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sent).toEqual([]);
  });

  it('is busy until the check for documents already in has settled, so a new hand-off cannot race it', async () => {
    // The kyc function answers only when the test says so.
    let answer: (reply: Response) => void = () => undefined;
    vi.stubGlobal('fetch', () => new Promise<Response>((resolve) => { answer = resolve; }));
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}>
        <DigilockerStep isResume />
      </RivrDataProvider>,
    );
    const button = screen.getByRole('button', { name: 'Continue to DigiLocker' });
    await vi.waitFor(() => expect(button.getAttribute('aria-busy')).toBe('true'));
    answer(Response.json({ status: 'waiting' }));
    await vi.waitFor(() => expect(button.getAttribute('aria-busy')).toBeNull());
  });

  it('says the app\'s check is down when Zoop cannot start it for a member already waiting for the desk', async () => {
    renderStep({ status: 200, body: { status: 'at_club' } });
    fireEvent.click(await continueButton());
    expect((await screen.findByRole('alert')).textContent).toMatch(/Try again shortly\.$/);
  });

  it('says why DigiLocker did not open, as an error with what to do', async () => {
    renderStep({ status: 502, body: { error: 'unavailable' } });
    fireEvent.click(await continueButton());
    expect((await screen.findByRole('alert')).textContent).toMatch(/Try again shortly\.$/);
  });

  it('says when today\'s tries are used up', async () => {
    renderStep({ status: 429, body: { error: 'too_many_attempts' } });
    fireEvent.click(await continueButton());
    expect((await screen.findByRole('alert')).textContent).toBe('Too many tries today. Try again tomorrow.');
    // Nothing to try again today (P-03).
    expect(screen.getByRole('button', { name: 'Continue to DigiLocker' }).hasAttribute('disabled')).toBe(true);
  });

  it('always offers Sign out, so no member is stuck here (P-03), and names no front desk (decision 0320)', () => {
    renderStep({ status: 200, body: {} });
    expect(screen.queryByText(/front desk/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
    expect(screen.getByText('Kept: your photo, date of birth, address, PAN and the last 4 digits of your Aadhaar.')).toBeDefined();
  });
});
