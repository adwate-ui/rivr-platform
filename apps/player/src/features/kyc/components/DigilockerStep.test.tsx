import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DigilockerStep } from './DigilockerStep.tsx';

/** Renders the DigiLocker step against a fake kyc function that answers the start with `reply`. */
function renderStep(reply: { status: number; body: unknown }) {
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } }));
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}>
      <DigilockerStep isResume />
    </RivrDataProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Identity › Resume', () => {
  it('picks up at DigiLocker, the selfie done, with what DigiLocker asks (K-09, decision 0320)', () => {
    renderStep({ status: 200, body: {} });
    expect(screen.getByRole('list', { name: 'Identity check' })).toBeDefined();
    expect(screen.getByText('Selfie').textContent).toBe('Selfie, done');
    expect(screen.getByText('DigiLocker').textContent).toBe('DigiLocker, current step');
    expect(screen.getByRole('heading', { name: 'Pick up where you left off' })).toBeDefined();
    expect(screen.getByText('Step 2 of 2')).toBeDefined();
    expect(screen.getByText('Aadhaar and OTP')).toBeDefined();
  });

  it('says why DigiLocker did not open, as an error with what to do', async () => {
    renderStep({ status: 502, body: { error: 'unavailable' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to DigiLocker' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Try again shortly\.$/);
  });

  it('says when today\'s tries are used up', async () => {
    renderStep({ status: 429, body: { error: 'too_many_attempts' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to DigiLocker' }));
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
