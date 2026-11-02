import { describe, expect, it } from 'vitest';
import { formatMobile, formatTypedMobile } from './phone.ts';

describe('formatMobile', () => {
  it('groups a mobile number five and five after +91', () => {
    expect(formatMobile('+919876543210')).toBe('+91 98765 43210');
    expect(formatMobile('+916000000001')).toBe('+91 60000 00001');
  });
});

describe('formatTypedMobile', () => {
  it('spaces the number five and five as it is typed', () => {
    expect(formatTypedMobile('98765')).toBe('98765');
    expect(formatTypedMobile('987654')).toBe('98765 4');
    expect(formatTypedMobile('9876543210')).toBe('98765 43210');
  });

  it('drops a pasted country code, hyphens and anything past ten digits', () => {
    expect(formatTypedMobile('+91 98765-43210')).toBe('98765 43210');
    expect(formatTypedMobile('919876543210')).toBe('98765 43210');
    expect(formatTypedMobile('98765432109')).toBe('98765 43210');
  });

  it('lets a deleted space go with the digit before it', () => {
    expect(formatTypedMobile('98765 ')).toBe('98765');
  });
});
