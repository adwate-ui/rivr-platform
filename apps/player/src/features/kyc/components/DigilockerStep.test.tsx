import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DigilockerStep } from './DigilockerStep.tsx';

/** Renders the DigiLocker step against a fake kyc function that answers the start with `reply`. */
function renderStep(reply: { status: number; body: unknown }) {
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } }));
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}>
      <DigilockerStep />
    </RivrDataProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DigilockerStep', () => {
  it('shows the steps, the selfie done and DigiLocker next with what it asks (K-09)', () => {
    renderStep({ status: 200, body: {} });
    expect(screen.getByRole('list', { name: 'Identity check' })).toBeDefined();
    expect(screen.getByText('Selfie').textContent).toBe('Selfie, done');
    expect(screen.getByText('DigiLocker').textContent).toBe('DigiLocker, current step');
    expect(screen.getByText('Your Aadhaar, its OTP and your consent.')).toBeDefined();
  });

  it('says why DigiLocker did not open, as an error with what to do', async () => {
    renderStep({ status: 502, body: { error: 'unavailable' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to DigiLocker' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Try again shortly\.$/);
  });

  it('says when today\'s tries are used up', async () => {
    renderStep({ status: 429, body: { error: 'too_many_attempts' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to DigiLocker' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Too many tries today. Try tomorrow or ask at the front desk.');
  });
});
