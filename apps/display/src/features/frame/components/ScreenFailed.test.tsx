import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OverlayFailed, ScreenFailed } from './ScreenFailed.tsx';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('a screen that fails to draw on a TV', () => {
  it('shows the TV line and tries the screen again every 30 seconds, as no one is there to press anything', () => {
    vi.useFakeTimers();
    const reset = vi.fn();
    render(<ScreenFailed error={new Error('A bad mode')} reset={reset} />);
    expect(screen.getByText('RIVR cannot be reached. This screen tries again in a few seconds.')).toBeDefined();
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(reset).toHaveBeenCalledOnce();
  });

  it('shows nothing in the stream overlay, and tries again all the same', () => {
    vi.useFakeTimers();
    const reset = vi.fn();
    const { container } = render(<OverlayFailed error={new Error('A bad clock')} reset={reset} />);
    expect(container.textContent).toBe('');
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(reset).toHaveBeenCalledOnce();
  });
});
