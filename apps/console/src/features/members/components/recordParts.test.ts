import { describe, expect, it } from 'vitest';
import { partsFor, recordHref } from './recordParts.ts';

const NONE = { manage: false, seePhoto: false, override: false, erase: false, changePhone: false };

describe('partsFor', () => {
  it('gives every staff member who reads members the visits alone', () => {
    expect(partsFor(NONE)).toEqual(['visits']);
  });

  it('adds the tier and a break for a membership manager', () => {
    expect(partsFor({ ...NONE, manage: true })).toEqual(['visits', 'membership']);
  });

  it('adds the account for a super admin, by any of its overrides, phone number or erasure', () => {
    expect(partsFor({ ...NONE, manage: true, override: true, changePhone: true, erase: true })).toEqual(['visits', 'membership', 'account']);
    expect(partsFor({ ...NONE, erase: true })).toEqual(['visits', 'account']);
  });
});

describe('recordHref', () => {
  it('puts the member in the address, and the part past the first', () => {
    expect(recordHref('m1')).toBe('/members?member=m1');
    expect(recordHref('m1', 'account')).toBe('/members?member=m1&part=account');
  });
});
