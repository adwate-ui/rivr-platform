import { describe, expect, it } from 'vitest';
import { kycReviewSchema } from './kycReview.ts';

describe('kycReviewSchema', () => {
  it('takes a reason, and a date of birth only when one is given', () => {
    expect(kycReviewSchema.parse({ reason: ' PAN card seen at the desk ', dateOfBirth: '' })).toEqual({
      reason: 'PAN card seen at the desk', dateOfBirth: undefined,
    });
    expect(kycReviewSchema.parse({ reason: 'Aadhaar seen', dateOfBirth: '1992-03-04' })).toEqual({ reason: 'Aadhaar seen', dateOfBirth: '1992-03-04' });
  });

  it('refuses a decision without a reason, or with a date that is not one', () => {
    expect(kycReviewSchema.safeParse({ reason: ' ', dateOfBirth: '' }).success).toBe(false);
    expect(kycReviewSchema.safeParse({ reason: 'Aadhaar seen', dateOfBirth: '04/03/1992' }).success).toBe(false);
  });
});
