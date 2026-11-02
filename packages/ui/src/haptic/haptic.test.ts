import { afterEach, describe, expect, it, vi } from 'vitest';
import { haptic } from './haptic.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('haptic', () => {
  it('buzzes for 12 ms where the phone can vibrate', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    haptic();
    expect(vibrate).toHaveBeenCalledWith(12);
  });

  it('does nothing where it cannot', () => {
    vi.stubGlobal('navigator', {});
    expect(() => haptic()).not.toThrow();
  });
});
