import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIsWide } from './useIsWide.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A window `width` wide, as matchMedia answers a min-width query. */
function windowOf(width: number) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: width >= Number(/min-width: (\d+)px/.exec(query)?.[1] ?? 0), addEventListener: () => undefined, removeEventListener: () => undefined,
  }));
}

describe('useIsWide', () => {
  it('says whether the window is at least a breakpoint wide: a phone is not a desk, a desk is', () => {
    windowOf(390);
    expect(renderHook(() => useIsWide('tablet')).result.current).toBe(false);
    windowOf(1440);
    expect(renderHook(() => useIsWide('tablet')).result.current).toBe(true);
    expect(renderHook(() => useIsWide('medium')).result.current).toBe(true);
  });
});
