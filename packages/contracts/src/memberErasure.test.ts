import { describe, expect, it } from 'vitest';
import { erasedKycFilesSchema } from './memberErasure.ts';

describe('erasedKycFilesSchema', () => {
  it('takes the member', () => {
    expect(erasedKycFilesSchema.parse({ memberId: '00000000-0000-4000-8000-0000000d0758' })).toEqual({ memberId: '00000000-0000-4000-8000-0000000d0758' });
  });

  it('refuses a member that is not an id, or none', () => {
    expect(erasedKycFilesSchema.safeParse({ memberId: '../00000000' }).success).toBe(false);
    expect(erasedKycFilesSchema.safeParse({}).success).toBe(false);
  });
});
