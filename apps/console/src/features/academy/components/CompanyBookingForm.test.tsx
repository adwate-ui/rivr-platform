import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompanyBookingForm } from './CompanyBookingForm.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('CompanyBookingForm', () => {
  it('books once: a tap retried after a failure sends the same request id', async () => {
    const requestIds: unknown[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes('/rest/v1/member')) return Response.json([{ id: 'm203' }]);
      const body: { p_request_id?: unknown } = JSON.parse(String(init?.body));
      requestIds.push(body.p_request_id);
      // The first attempt fails as a dropped connection would; the retry books.
      return requestIds.length === 1 ? Response.json({ message: 'down' }, { status: 500 }) : Response.json('k1');
    });
    const onDone = vi.fn();
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}>
        <CompanyBookingForm venueId="v1" batchId="b1" onDone={onDone} />
      </RivrDataProvider>,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Contact mobile number' }), { target: { value: '9000000203' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Company' }), { target: { value: 'Acme Pvt Ltd' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Heads' }), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Book' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Could not save this. Check the connection and try again.');

    fireEvent.click(screen.getByRole('button', { name: 'Book' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(requestIds).toHaveLength(2);
    expect(requestIds[1]).toBe(requestIds[0]);
  });
});
