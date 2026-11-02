import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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
    expect(screen.getByText('Offline. What you see may be out of date.')).toBeDefined();
  });
});
