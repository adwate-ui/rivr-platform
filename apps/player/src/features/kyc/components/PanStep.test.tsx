import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PanStep } from './PanStep.tsx';

/** Renders the PAN step against a fake kyc function that answers with `reply`. */
function renderPanStep(reply: { status: number; body: unknown }, knowsDateOfBirth = true) {
  const requests: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input instanceof Request ? input.url : input).includes('/functions/v1/kyc')) requests.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json' } });
  });
  const onChecked = vi.fn();
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}>
      <PanStep knowsDateOfBirth={knowsDateOfBirth} onChecked={onChecked} />
    </RivrDataProvider>,
  );
  return { requests, onChecked };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PanStep', () => {
  it('verifies the PAN, in capitals, and moves on', async () => {
    const { requests, onChecked } = renderPanStep({ status: 200, body: { status: 'verified' } });

    fireEvent.change(screen.getByRole('textbox', { name: 'PAN' }), { target: { value: 'abcpe1234f' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => expect(onChecked).toHaveBeenCalledOnce());
    expect(requests).toEqual([{ action: 'pan', pan: 'ABCPE1234F' }]);
  });

  it('says so when the PAN does not match', async () => {
    renderPanStep({ status: 422, body: { error: 'pan_rejected' } });

    fireEvent.change(screen.getByRole('textbox', { name: 'PAN' }), { target: { value: 'ABCPE1234F' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('This PAN did not match. Check it and the name, then try again.')).toBeDefined();
  });

  it('asks for the date of birth when DigiLocker gave none, and never for a name', async () => {
    const { requests } = renderPanStep({ status: 200, body: { status: 'verified' } }, false);

    fireEvent.change(screen.getByRole('textbox', { name: 'PAN' }), { target: { value: 'ABCPE1234F' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('Enter your date of birth.')).toBeDefined();
    expect(screen.queryByRole('textbox', { name: /name/i })).toBeNull();
    expect(requests).toEqual([]);
  });
});
