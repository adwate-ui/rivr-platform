import { createRivrClient, RivrDataProvider } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TonightBanners, type TonightBannersProps } from './TonightBanners.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const NOTICES = [{ noticeId: 'n1', body: 'RIVR opens on Sunday 15 November.' }];
// 22:41 IST.
const SHOWN_AT = Date.parse('2026-11-02T17:11:00Z');

function renderBanners(props: Partial<TonightBannersProps> = {}) {
  vi.stubGlobal('fetch', async () => Response.json([]));
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TonightBanners notices={NOTICES} isBrowsing shownAt={SHOWN_AT} hasRefreshFailed={false} onRetry={() => undefined} {...props} />
    </RivrDataProvider>,
  );
}

describe('Tonight › banners', () => {
  it('shows the club\'s notices while browsing, each dismissible', () => {
    renderBanners();
    expect(screen.getByText('RIVR opens on Sunday 15 November.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('RIVR opens on Sunday 15 November.')).toBeNull();
  });

  it('keeps notices away while the member waits or plays', () => {
    renderBanners({ isBrowsing: false });
    expect(screen.queryByText('RIVR opens on Sunday 15 November.')).toBeNull();
  });

  it('says a refresh failed and when the shown tables came, with Retry', () => {
    const onRetry = vi.fn();
    renderBanners({ hasRefreshFailed: true, onRetry, notices: [] });
    expect(screen.getByText("Couldn't refresh. Showing 22:41.")).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('says the call time ends soon, with Add time', () => {
    const onAddTime = vi.fn();
    renderBanners({ callEnding: { minutes: 14, onAddTime }, notices: [] });
    expect(screen.getByText('Call time ends in 14 min')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Add time' }));
    expect(onAddTime).toHaveBeenCalledOnce();
  });

  it('says it is offline, showing the tables as they last came', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderBanners({ notices: [] });
    expect(screen.getByText('Offline. Showing tables as of 22:41.')).toBeDefined();
  });
});
