import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TonightBanners, type TonightBannersProps } from './TonightBanners.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// 22:41 IST.
const SHOWN_AT = Date.parse('2026-11-02T17:11:00Z');

function renderBanners(props: Partial<TonightBannersProps> = {}) {
  vi.stubGlobal('fetch', async () => Response.json([]));
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TonightBanners shownAt={SHOWN_AT} hasRefreshFailed={false} onRetry={() => undefined} {...props} />
    </RivrDataProvider>,
  );
}

describe('Tonight › banners', () => {
  it('says a refresh failed and when the shown tables came, with Retry', () => {
    const onRetry = vi.fn();
    renderBanners({ hasRefreshFailed: true, onRetry });
    expect(screen.getByText("Couldn't refresh. Showing 22:41.")).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('says the call time ends soon, with Add time', () => {
    const onAddTime = vi.fn();
    renderBanners({ callEnding: { minutes: 14, onAddTime } });
    expect(screen.getByText('Call time ends in 14 min')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Add time' }));
    expect(onAddTime).toHaveBeenCalledOnce();
  });

  it('says it is offline, showing the tables as they last came', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderBanners();
    expect(screen.getByText('No connection. Showing tables as of 22:41.')).toBeDefined();
  });
});
