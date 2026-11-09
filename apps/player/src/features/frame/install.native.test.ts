import { Capacitor } from '@capacitor/core';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useInstallOffer } from './install.ts';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function offerOnAnIphone() {
  localStorage.setItem('rivr-visits', '2');
  vi.stubGlobal('navigator', { userAgent: 'iPhone' });
  return renderHook(() => useInstallOffer(true)).result.current.kind;
}

describe('the install offer', () => {
  it('is made in the browser', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    expect(offerOnAnIphone()).toBe('ios');
  });

  it('is not made inside the store app, which is already installed', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    expect(offerOnAnIphone()).toBeNull();
  });
});
