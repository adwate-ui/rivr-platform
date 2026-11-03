import type { FloorRequest } from '@rivr/db';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRequestQueue } from './useRequestQueue.ts';

afterEach(() => {
  vi.useRealTimers();
});

const join = (id: string, fullName: string): FloorRequest => ({ kind: 'join', id, memberId: `m-${id}`, fullName, tableId: 't1', since: '2026-11-15T16:00:00Z' });
const names = (requests: readonly FloorRequest[]) => requests.map((request) => request.fullName);

describe('the requests queue (console v3)', () => {
  it('marks a request that arrives after the first read as new for 2.5 s, and opens a folded panel', () => {
    vi.useFakeTimers();
    const onArrive = vi.fn();
    const { result, rerender } = renderHook(({ requests }) => useRequestQueue(requests, onArrive), { initialProps: { requests: [join('e1', 'Ritika Bhalla')] } });
    expect(result.current.fresh.size).toBe(0);
    expect(onArrive).not.toHaveBeenCalled();
    rerender({ requests: [join('e1', 'Ritika Bhalla'), join('e2', 'Leela Menon')] });
    expect([...result.current.fresh]).toEqual(['join:e2']);
    expect(onArrive).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(2500));
    expect(result.current.fresh.size).toBe(0);
  });

  it('keeps the order under the pointer: what was done goes, what arrives joins the end, and oldest first once it leaves', () => {
    const { result, rerender } = renderHook(({ requests }) => useRequestQueue(requests, () => undefined), {
      initialProps: { requests: [join('e1', 'Ritika Bhalla'), join('e2', 'Leela Menon')] },
    });
    act(() => result.current.hold(true));
    rerender({ requests: [join('e0', 'Riya Sen'), join('e2', 'Leela Menon')] });
    expect(names(result.current.shown)).toEqual(['Leela Menon', 'Riya Sen']);
    act(() => result.current.hold(false));
    expect(names(result.current.shown)).toEqual(['Riya Sen', 'Leela Menon']);
  });
});
