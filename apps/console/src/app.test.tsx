import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createAppRouter } from './router.tsx';

afterEach(cleanup);

// No one is signed in, so nothing is fetched: the client never reaches this address.
const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });

function renderAt(path: string) {
  return render(
    <RivrDataProvider client={client}>
      <RouterProvider router={createAppRouter(createMemoryHistory({ initialEntries: [path] }))} />
    </RivrDataProvider>,
  );
}

describe('the console', () => {
  it('opens on Live floor with the rail', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Live floor' })).toBeDefined();
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Live floor' })).toBeDefined();
  });

  it('says so when a page does not exist', async () => {
    renderAt('/nowhere');
    expect(await screen.findByText('This page does not exist.')).toBeDefined();
  });
});
