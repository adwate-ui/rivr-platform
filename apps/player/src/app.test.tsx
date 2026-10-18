import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createAppRouter } from './router.tsx';

afterEach(cleanup);

// Nothing listens at this address: signed out, nothing is fetched, and a sign-in request fails.
const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });

function renderAt(path: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  return render(
    <RivrDataProvider client={client}>
      <RouterProvider router={router} />
    </RivrDataProvider>,
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

describe('sign-in', () => {
  it('opens on its own with the lockup and the motto, once, and no tab bar', async () => {
    renderAt('/sign-in');
    expect(await screen.findByRole('img', { name: 'RIVR Poker Club' })).toBeDefined();
    expect(screen.getAllByText('Skill runs deep.')).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'Mobile number' })).toBeDefined();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });

  it('asks for a ten-digit mobile number before sending anything', async () => {
    renderAt('/sign-in');
    fireEvent.change(await screen.findByRole('textbox', { name: 'Mobile number' }), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText('Enter a 10-digit mobile number.')).toBeDefined();
  });

  it('says sign-in is not available when Auth cannot be reached', async () => {
    renderAt('/sign-in');
    fireEvent.change(await screen.findByRole('textbox', { name: 'Mobile number' }), { target: { value: '98765 43210' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText('Sign-in is not available right now. Try again in a few minutes.', {}, { timeout: 3000 })).toBeDefined();
  });
});
