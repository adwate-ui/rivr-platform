import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { I18nProvider } from '@rivr/i18n';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createAppRouter } from './router.tsx';

afterEach(cleanup);

// No one is signed in, so nothing is fetched: the client never reaches this address.
const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });

function renderAt(path: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  return render(
    <I18nProvider locale="en">
      <RivrDataProvider client={client}>
        <RouterProvider router={router} />
      </RivrDataProvider>
    </I18nProvider>,
  );
}

describe('the player app', () => {
  it('opens on Tonight inside the frame', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Tonight' })).toBeDefined();
    expect(screen.getByText('No tables are running.')).toBeDefined();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeDefined();
  });

  it('keeps gated tabs out of the tab bar until the member’s access is known', async () => {
    renderAt('/');
    await screen.findByRole('heading', { name: 'Tonight' });
    expect(screen.getByRole('link', { name: 'Balance' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Learn' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Sessions' })).toBeNull();
  });

  it('shows no Learn screen to someone without access', async () => {
    renderAt('/learn');
    await screen.findByRole('navigation', { name: 'Main' });
    expect(screen.queryByRole('heading', { name: 'Learn' })).toBeNull();
  });

  it('says so when a page does not exist', async () => {
    renderAt('/nowhere');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeDefined();
    expect(screen.getByText('This page does not exist.')).toBeDefined();
  });
});
