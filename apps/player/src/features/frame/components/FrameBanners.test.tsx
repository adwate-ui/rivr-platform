import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { takeUpdateWhenHidden } from '../update.ts';
import { FrameBanners } from './FrameBanners.tsx';

function goOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

afterEach(() => {
  goOnline(true);
  cleanup();
});

describe('the frame’s banners (decision 0320)', () => {
  it('says the phone is offline at the top of a screen other than Tonight, and nothing while it is online', () => {
    render(
      <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={new QueryClient()}>
        <FrameBanners />
      </RivrDataProvider>,
    );
    expect(screen.queryByRole('status')).toBeNull();
    act(() => goOnline(false));
    expect(screen.getByText('No connection. What you see may be out of date.')).toBeDefined();
  });

  it('offers a new version of the app with Refresh, which takes it', () => {
    const take = vi.fn();
    render(<FrameBanners />);
    expect(screen.queryByRole('status')).toBeNull();
    // On Home, in sight and after the launch: the version waits for its moment.
    act(() => takeUpdateWhenHidden(take));
    expect(screen.getByText('A new version of RIVR is ready.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(take).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('A new version of RIVR is ready.')).toBeNull();
  });
});
