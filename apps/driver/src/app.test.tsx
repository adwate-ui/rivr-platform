import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createAppRouter } from './router.tsx';

afterEach(cleanup);

// No one is signed in, so nothing is fetched: the client never reaches this address.
const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });

describe('the driver app', () => {
  it('opens on pickups', async () => {
    render(
      <RivrDataProvider client={client}>
        <RouterProvider router={createAppRouter(createMemoryHistory({ initialEntries: ['/'] }))} />
      </RivrDataProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'Pickups' })).toBeDefined();
    expect(screen.getByText('No pickups.')).toBeDefined();
  });
});
