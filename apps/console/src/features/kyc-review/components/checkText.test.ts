import type { KycCheck } from '@rivr/db';
import { describe, expect, it } from 'vitest';
import { checkDetails, checkGroups, mayReopen } from './checkText.ts';

const REFUSED: KycCheck = {
  memberId: 'm1', fullName: 'Asha Rao', status: 'refused', method: 'manual', waitingBecause: null, dateOfBirth: null, maskedAadhaar: null,
  pan: null, address: null, photoPath: null, livenessScore: null, faceMatchScore: null, vendorReference: null, refusal: 'duplicate_pan',
  clashesWith: [], updatedAt: '2026-11-01T10:00:00Z',
};

describe('checkDetails', () => {
  it('leaves out every detail a check waiting on the member does not hold, keeping how it was made', () => {
    expect(checkDetails({ ...REFUSED, status: 'needs_pan', method: 'digilocker', refusal: null })).toEqual([{ label: 'Method', value: 'DigiLocker' }]);
  });

  it('says a missing date of birth is not kept while a reviewer must enter it, and shows the scores the vendor gave', () => {
    const check: KycCheck = { ...REFUSED, status: 'needs_review', method: 'digilocker', refusal: null, pan: 'ABCPR4444R', livenessScore: 91 };
    expect(checkDetails(check)).toEqual([
      { label: 'Date of birth', value: 'Not kept. Check the original document.' },
      { label: 'PAN', value: 'ABCPR4444R' },
      { label: 'DigiLocker', value: 'Liveness 91, face match None' },
    ]);
  });
});

describe('checkGroups', () => {
  it('puts checks waiting on the member apart from those to review and those refused', () => {
    const groups = checkGroups([
      { ...REFUSED, memberId: 'review', status: 'needs_review', refusal: null },
      { ...REFUSED, memberId: 'pan', status: 'needs_pan', refusal: null },
      REFUSED,
    ]);
    expect([groups.toReview, groups.onMember, groups.refused].map((group) => group.map((check) => check.memberId))).toEqual([['review'], ['pan'], ['m1']]);
  });
});

describe('mayReopen', () => {
  it('offers a super admin Reopen for an in-person check refused as a duplicate PAN or Aadhaar, which the database reopens', () => {
    expect(mayReopen(REFUSED, true)).toBe(true);
    expect(mayReopen({ ...REFUSED, refusal: 'duplicate_aadhaar' }, true)).toBe(true);
  });

  it('offers it for no other refusal, as the database would refuse it', () => {
    for (const refusal of ['under_18', 'staff_rejected', 'duplicate_face', 'on_break'] as const) {
      expect(mayReopen({ ...REFUSED, refusal }, true)).toBe(false);
    }
  });

  it('offers a super admin Reopen for a check the vendor held while the club checks identity at the desk (decision 0502)', () => {
    const held = { ...REFUSED, method: 'digilocker' } as const;
    expect(mayReopen(held, true, true)).toBe(true);
    expect(mayReopen({ ...held, status: 'needs_review', refusal: null }, true, true)).toBe(true);
    expect(mayReopen({ ...held, refusal: 'under_18' }, true, true)).toBe(false);
    expect(mayReopen({ ...held, status: 'needs_pan', refusal: null }, true, true)).toBe(false);
    expect(mayReopen(held, false, true)).toBe(false);
    expect(mayReopen({ ...held, status: 'needs_review', refusal: null }, true, false)).toBe(false);
  });

  it('offers it to no one but a super admin, and for no check not done in person', () => {
    expect(mayReopen(REFUSED, false)).toBe(false);
    expect(mayReopen({ ...REFUSED, method: 'digilocker' }, true)).toBe(false);
  });
});
