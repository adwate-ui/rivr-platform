import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createAppRouter } from './router.tsx';

afterEach(cleanup);

// No one is signed in, so nothing is fetched: the client never reaches this address.
const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });

describe('the dealer tablet', () => {
  it('opens on hand entry and says it is not assigned to a table', async () => {
    render(
      <RivrDataProvider client={client}>
        <RouterProvider router={createAppRouter(createMemoryHistory({ initialEntries: ['/'] }))} />
      </RivrDataProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'Hand entry' })).toBeDefined();
    expect(screen.getByText('Not assigned')).toBeDefined();
    expect(screen.getByText('This tablet is not assigned to a table.')).toBeDefined();
  });
});
