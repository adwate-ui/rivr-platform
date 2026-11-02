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

    expect(await screen.findByText('This PAN did not verify. Check it and try again.')).toBeDefined();
  });

  it('asks for the date of birth when DigiLocker gave none, and never for a name', async () => {
    const { requests } = renderPanStep({ status: 200, body: { status: 'verified' } }, false);

    fireEvent.change(screen.getByRole('textbox', { name: 'PAN' }), { target: { value: 'ABCPE1234F' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('Enter your date of birth.')).toBeDefined();
    expect(screen.queryByRole('textbox', { name: /name/i })).toBeNull();
    expect(requests).toEqual([]);
  });

  it('PAN fallback: takes the date of birth as DD / MM / YYYY in a numeric field, and sends it as an ISO day', async () => {
    const { requests } = renderPanStep({ status: 200, body: { status: 'verified' } }, false);
    const birth = screen.getByRole('textbox', { name: 'Date of birth' });
    expect(birth.getAttribute('inputmode')).toBe('numeric');
    expect(birth.getAttribute('type')).toBe('text');
    fireEvent.change(birth, { target: { value: '14031990' } });
    expect(birth).toHaveProperty('value', '14 / 03 / 1990');
    fireEvent.change(screen.getByRole('textbox', { name: 'PAN' }), { target: { value: 'abcpe1234f' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => expect(requests).toEqual([{ action: 'pan', pan: 'ABCPE1234F', dateOfBirth: '1990-03-14' }]));
  });

  it('offers DigiLocker again after it failed, and says why when it cannot start', async () => {
    const { requests } = renderPanStep({ status: 503, body: { error: 'unavailable' } }, false);

    fireEvent.click(screen.getByRole('button', { name: 'Try DigiLocker again' }));

    expect(await screen.findByText('Identity checks are down. Try again shortly.')).toBeDefined();
    expect(requests).toEqual([{ action: 'start' }]);
  });

  it('does not offer DigiLocker again to a member it matched who has no PAN in it', () => {
    renderPanStep({ status: 200, body: { status: 'verified' } }, true);

    expect(screen.queryByRole('button', { name: 'Try DigiLocker again' })).toBeNull();
  });
});
