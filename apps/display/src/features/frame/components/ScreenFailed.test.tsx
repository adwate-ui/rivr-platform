import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScreenFailed } from './ScreenFailed.tsx';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('a screen that fails to draw on a TV', () => {
  it('shows the TV line and tries the screen again every 30 seconds, as no one is there to press anything', () => {
    vi.useFakeTimers();
    const reset = vi.fn();
    render(<ScreenFailed error={new Error('A bad mode')} reset={reset} />);
    expect(screen.getByText('No connection. Retrying shortly.')).toBeDefined();
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(reset).toHaveBeenCalledOnce();
  });
});
