import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfflineStart } from './OfflineStart.tsx';

const SHELL = 'https://tablet.rivr.club/';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the offline start page', () => {
  it('says the tablet is waiting for the network, and opens RIVR Dealer once the bundle answers', async () => {
    vi.useFakeTimers();
    const reach = vi.fn<(url: string) => Promise<boolean>>().mockResolvedValueOnce(false).mockResolvedValue(true);
    const open = vi.fn<(url: string) => void>();
    render(<OfflineStart shellUrl={SHELL} reach={reach} open={open} />);
    expect(screen.getByRole('heading', { name: 'Waiting for the network' })).toBeDefined();

    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(reach).toHaveBeenCalledWith(SHELL);
    expect(open).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(open).toHaveBeenCalledWith(SHELL);
  });

  it('tries at once with Retry', async () => {
    const open = vi.fn<(url: string) => void>();
    render(<OfflineStart shellUrl={SHELL} reach={() => Promise.resolve(true)} open={open} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });
    expect(open).toHaveBeenCalledWith(SHELL);
  });
});
