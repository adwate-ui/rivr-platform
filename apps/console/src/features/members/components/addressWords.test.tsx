import { Button } from '@rivr/ui';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useAddressWords } from './addressWords.ts';

afterEach(cleanup);

/** A list's tier, kept in the address: shown, and changed by a button. */
function Tier() {
  const [tier, setTier] = useAddressWords('tier');
  return <Button onClick={() => setTier('founders')}>{tier === '' ? 'Every tier' : tier}</Button>;
}

describe('useAddressWords (owner, 9 Nov)', () => {
  it('reads its words from the address, writes them there in place, and follows Back', async () => {
    const router = createRouter({ routeTree: createRootRoute({ component: Tier }), history: createMemoryHistory({ initialEntries: ['/members?tier=black'] }) });
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole('button', { name: 'black' })).toBeDefined();
    // A record opens: a new entry, the tier kept.
    await act(async () => { await router.navigate({ href: '/members?tier=black&member=m1' }); });
    fireEvent.click(screen.getByRole('button', { name: 'black' }));
    expect(screen.getByRole('button', { name: 'founders' })).toBeDefined();
    expect(router.history.location.search).toContain('tier=founders');
    // Back to the list as it was before the record opened: the tier it had.
    await act(async () => { router.history.back(); await new Promise((done) => { setTimeout(done, 0); }); });
    expect(await screen.findByRole('button', { name: 'black' })).toBeDefined();
  });
});
