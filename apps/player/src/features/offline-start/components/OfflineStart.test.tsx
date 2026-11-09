import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfflineStart } from './OfflineStart.tsx';

const SHELL = 'https://app.rivrpoker.com/';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the offline start page', () => {
  it('says there is no network, and opens the app once it answers', async () => {
    vi.useFakeTimers();
    const reach = vi.fn<(url: string) => Promise<boolean>>().mockResolvedValueOnce(false).mockResolvedValue(true);
    const open = vi.fn<(url: string) => void>();
    render(<OfflineStart shellUrl={SHELL} reach={reach} open={open} />);
    expect(screen.getByRole('heading', { name: 'No network' })).toBeDefined();
    await act(() => vi.advanceTimersByTimeAsync(5_000));
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
