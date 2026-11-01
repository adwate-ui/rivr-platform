import type { KycCheck } from '@rivr/db';
import { describe, expect, it } from 'vitest';
import { mayReopen } from './checkText.ts';

const REFUSED: KycCheck = {
  memberId: 'm1', fullName: 'Asha Rao', status: 'refused', method: 'manual', waitingBecause: null, dateOfBirth: null, maskedAadhaar: null,
  pan: null, address: null, photoPath: null, livenessScore: null, faceMatchScore: null, vendorReference: null, refusal: 'duplicate_pan',
  clashesWith: [], updatedAt: '2026-11-01T10:00:00Z',
};

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

  it('offers it to no one but a super admin, and for no check not done in person', () => {
    expect(mayReopen(REFUSED, false)).toBe(false);
    expect(mayReopen({ ...REFUSED, method: 'digilocker' }, true)).toBe(false);
  });
});
