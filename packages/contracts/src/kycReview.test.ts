import { describe, expect, it } from 'vitest';
import { kycReviewSchema } from './kycReview.ts';

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
