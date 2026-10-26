import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSlides } from './PromotionsMode.tsx';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the promotions slides (#86, decision 0163)', () => {
  it('on their own, turn every 12 seconds, round and round', () => {
    const { result } = renderHook(() => useSlides(3, undefined));
    expect(result.current).toBe(0);
    act(() => { vi.advanceTimersByTime(12_000); });
    expect(result.current).toBe(1);
    act(() => { vi.advanceTimersByTime(24_000); });
    expect(result.current).toBe(0);
  });

  it('in a rotation, show each once, then hand on to the next board', () => {
    const onDone = vi.fn();
    renderHook(() => useSlides(2, onDone));
    act(() => { vi.advanceTimersByTime(12_000); });
    expect(onDone).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(12_000); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('in a rotation with none live, hand on at once; while loading, wait', () => {
    const onDone = vi.fn();
    const loading: { count: number | undefined } = { count: undefined };
    const { rerender } = renderHook(({ count }) => useSlides(count, onDone), { initialProps: loading });
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(onDone).not.toHaveBeenCalled();
    rerender({ count: 0 });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
