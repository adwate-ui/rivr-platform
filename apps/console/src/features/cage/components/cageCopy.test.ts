import type { CageMember } from '@rivr/db';
import { fromPaise } from '@rivr/domain/money';
import { t } from '@rivr/i18n';
import { describe, expect, it } from 'vitest';
import { CAGE_FAILURE_COPY, kycBlockOf } from './cageCopy.ts';

const NAINA: CageMember = {
  memberId: 'm1', fullName: 'Naina Kapoor', tierName: 'Member', isKycComplete: false, kycRefusal: null, photoPath: null,
  wallet: fromPaise(0n), bonus: fromPaise(0n), markers: fromPaise(0n), seat: null, breakUntil: null, callTimeOwed: 0, isLetGoEarly: false,
};

describe('what the cage says of a member\'s identity check (#58)', () => {
  it('says why it failed, in the KYC review\'s words', () => {
    expect(kycBlockOf({ ...NAINA, kycRefusal: 'under_18' })).toBe('Refused: under the minimum age.');
    expect(kycBlockOf({ ...NAINA, kycRefusal: 'duplicate_pan' })).toBe('Refused: the PAN of a verified member.');
    expect(kycBlockOf({ ...NAINA, kycRefusal: 'staff_rejected' })).toBe('Rejected by a reviewer.');
  });

  it('or that it is not finished', () => {
    expect(kycBlockOf(NAINA)).toBe('KYC incomplete. No chips, credit or cash-out until it is approved.');
  });

  it('refuses a write for the reason, and says what to do', () => {
    expect(t(CAGE_FAILURE_COPY.under_age)).toBe('Refused: under the venue\'s minimum age. No chips, credit or cash-out.');
    expect(t(CAGE_FAILURE_COPY.duplicate)).toBe('Refused: the identity of another verified member. Ask a KYC reviewer to look at the check.');
  });
});
