import { ok, panSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { createFakeKyc, panRecheckOutcome } from './index.ts';

const check = { pan: panSchema.parse('ABCPG3001G'), name: 'Anaya Gill', dateOfBirth: '1990-04-04' };
const answer = { isValid: true, nameMatches: true, dateOfBirthMatches: true, vendorReference: 'fake-pan' };

describe('re-checking a KYC check made in person', () => {
  it('finds a match when the vendor knows the PAN in the name and date of birth given', async () => {
    expect(panRecheckOutcome(await createFakeKyc().verifyPan(check))).toBe('matched');
  });

  it('finds a mismatch when the vendor does not know the PAN', async () => {
    expect(panRecheckOutcome(await createFakeKyc({ isPanValid: false }).verifyPan(check))).toBe('pan_invalid');
  });

  it('says which detail differs when the PAN is real', () => {
    expect(panRecheckOutcome(ok({ ...answer, nameMatches: false }))).toBe('name_differs');
    expect(panRecheckOutcome(ok({ ...answer, dateOfBirthMatches: false }))).toBe('date_of_birth_differs');
  });

  it('leaves the check for later when the vendor cannot answer', async () => {
    const kyc = createFakeKyc();
    kyc.failNext({ code: 'unavailable' });
    expect(panRecheckOutcome(await kyc.verifyPan(check))).toBeNull();
  });
});
