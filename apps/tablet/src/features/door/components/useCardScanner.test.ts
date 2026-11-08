import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCardScanner } from './useCardScanner.ts';

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

describe('the door kiosk\u2019s camera', () => {
  it('says when the camera cannot start, and tries again when asked (F-145)', async () => {
    const stream = { getTracks: () => [] };
    const getUserMedia = vi.fn().mockRejectedValueOnce(new Error('NotAllowedError')).mockResolvedValue(stream);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    const { result } = renderHook(() => useCardScanner(() => null));
    await waitFor(() => expect(result.current.cameraError).toBe(true));
    act(() => result.current.retryCamera());
    expect(result.current.cameraError).toBe(false);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
  });
});
