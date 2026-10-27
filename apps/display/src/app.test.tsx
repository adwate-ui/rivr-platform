import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createAppRouter } from './router.tsx';

afterEach(cleanup);

// No one is signed in, and nothing answers at this address, so the TV cannot get a pairing code.
const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });

describe('the TV display', () => {
  it('asks to be paired until the console pairs it, and says when it cannot get a code', async () => {
    render(
      <RivrDataProvider client={client}>
        <RouterProvider router={createAppRouter(createMemoryHistory({ initialEntries: ['/'] }))} />
      </RivrDataProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'Screen pairing' })).toBeDefined();
    expect(await screen.findByText('RIVR cannot be reached. This screen tries again in a minute.')).toBeDefined();
  });

  it.each(['/overlay?delay=900', '/nowhere'])('asks to be paired at %s too: the stream overlay pairs as a TV', async (address) => {
    render(
      <RivrDataProvider client={client}>
        <RouterProvider router={createAppRouter(createMemoryHistory({ initialEntries: [address] }))} />
      </RivrDataProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'Screen pairing' })).toBeDefined();
  });
});
