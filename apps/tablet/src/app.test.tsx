import 'fake-indexeddb/auto';
import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createAppRouter } from './router.tsx';

afterEach(cleanup);

// No one is signed in, so nothing is fetched: the client never reaches this address.
const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });

describe('the dealer tablet', () => {
  it('asks for a pairing code until it is paired, whatever screen it opens on', async () => {
    render(
      <RivrDataProvider client={client}>
        <RouterProvider router={createAppRouter(createMemoryHistory({ initialEntries: ['/'] }))} />
      </RivrDataProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'Tablet pairing' })).toBeDefined();
    expect(screen.getByText('Not paired')).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Pairing code' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Seats' })).toBeNull();
  });
});
