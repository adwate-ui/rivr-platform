import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIdleLock } from './useIdleLock.ts';

const MINUTE = 60_000;

// The cage idle lock, task 384.
describe('the cage idle lock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('locks a cage screen after ten idle minutes, and not before', () => {
    const onLock = vi.fn();
    renderHook(() => useIdleLock(true, onLock));
    vi.advanceTimersByTime(9 * MINUTE);
    expect(onLock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2 * MINUTE);
    expect(onLock).toHaveBeenCalledOnce();
  });

  it('counts a key or a touch as activity', () => {
    const onLock = vi.fn();
    renderHook(() => useIdleLock(true, onLock));
    vi.advanceTimersByTime(9 * MINUTE);
    globalThis.dispatchEvent(new KeyboardEvent('keydown'));
    vi.advanceTimersByTime(9 * MINUTE);
    globalThis.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(9 * MINUTE);
    expect(onLock).not.toHaveBeenCalled();
  });

  it('locks on the first key after ten idle minutes, as when a sleeping computer wakes', () => {
    const onLock = vi.fn();
    renderHook(() => useIdleLock(true, onLock));
    vi.setSystemTime(Date.now() + 30 * MINUTE);
    globalThis.dispatchEvent(new KeyboardEvent('keydown'));
    expect(onLock).toHaveBeenCalledOnce();
  });

  it('holds across a reload: a cage screen opened after ten idle minutes locks at once', () => {
    // The page before the reload: a reload runs no clean-up, so it stays mounted here.
    renderHook(() => useIdleLock(true, vi.fn()));
    vi.setSystemTime(Date.now() + 11 * MINUTE);
    const onLock = vi.fn();
    renderHook(() => useIdleLock(true, onLock));
    expect(onLock).toHaveBeenCalledOnce();
  });

  it('never locks other screens', () => {
    const onLock = vi.fn();
    renderHook(() => useIdleLock(false, onLock));
    vi.advanceTimersByTime(30 * MINUTE);
    expect(onLock).not.toHaveBeenCalled();
  });
});
