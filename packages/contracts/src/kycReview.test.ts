import { describe, expect, it } from 'vitest';
import { kycInPersonSchema, kycReviewSchema } from './kycReview.ts';

const IN_PERSON = { memberId: '00000000-0000-4000-8000-000000000203', dateOfBirth: '1990-04-12', aadhaarLast4: '1234', pan: ' abcpn1234d ', consent: true };

describe('kycInPersonSchema', () => {
  it('takes the date of birth, the last four Aadhaar digits, the PAN and the member\'s consent', () => {
    expect(kycInPersonSchema.parse(IN_PERSON)).toEqual({ ...IN_PERSON, pan: 'ABCPN1234D' });
  });

  it('refuses the whole Aadhaar number, a malformed PAN, or no consent', () => {
    expect(kycInPersonSchema.safeParse({ ...IN_PERSON, aadhaarLast4: '123412341234' }).success).toBe(false);
    expect(kycInPersonSchema.safeParse({ ...IN_PERSON, pan: 'ABC1234' }).success).toBe(false);
    expect(kycInPersonSchema.safeParse({ ...IN_PERSON, consent: false }).success).toBe(false);
  });
});

describe('kycReviewSchema', () => {
  it('takes a reason, and a date of birth and PAN only when one is given', () => {
    expect(kycReviewSchema.parse({ reason: ' PAN card seen at the desk ', dateOfBirth: '', pan: '' })).toEqual({
      reason: 'PAN card seen at the desk', dateOfBirth: undefined, pan: undefined,
    });
    expect(kycReviewSchema.parse({ reason: 'Aadhaar seen', dateOfBirth: '1992-03-04', pan: ' abcpn5555n ' })).toEqual({
      reason: 'Aadhaar seen', dateOfBirth: '1992-03-04', pan: 'ABCPN5555N',
    });
  });

  it('refuses a decision without a reason, with a document number in it, or with a date or PAN that is not one', () => {
    expect(kycReviewSchema.safeParse({ reason: ' ', dateOfBirth: '', pan: '' }).success).toBe(false);
    expect(kycReviewSchema.safeParse({ reason: 'Aadhaar 1234 5678 9012 seen', dateOfBirth: '', pan: '' }).success).toBe(false);
    expect(kycReviewSchema.safeParse({ reason: 'Card abcpn5555n seen', dateOfBirth: '', pan: '' }).success).toBe(false);
    expect(kycReviewSchema.safeParse({ reason: 'Aadhaar seen', dateOfBirth: '04/03/1992', pan: '' }).success).toBe(false);
    expect(kycReviewSchema.safeParse({ reason: 'Aadhaar seen', dateOfBirth: '', pan: 'ABC123' }).success).toBe(false);
  });
});
