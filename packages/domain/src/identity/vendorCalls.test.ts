import { describe, expect, it } from 'vitest';
import { isVendorCallGivenBack } from './vendorCalls.ts';

describe('isVendorCallGivenBack (the owner, 9 Nov)', () => {
  it('gives back a call that failed on the vendor\'s side', () => {
    for (const code of ['unavailable', 'rate_limited', 'not_configured']) expect(isVendorCallGivenBack(code)).toBe(true);
  });

  it('keeps one the vendor answered with a refusal', () => {
    expect(isVendorCallGivenBack('rejected')).toBe(false);
  });
});
