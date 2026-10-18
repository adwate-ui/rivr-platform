import { describe, expect, it } from 'vitest';
import { formatMobile } from './phone.ts';

describe('formatMobile', () => {
  it('groups a mobile number five and five after +91', () => {
    expect(formatMobile('+919876543210')).toBe('+91 98765 43210');
    expect(formatMobile('+916000000001')).toBe('+91 60000 00001');
  });
});
