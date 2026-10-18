import { describe, expect, it } from 'vitest';
import { academyBatchSchema, companyBookingSchema } from './academy.ts';

describe('academyBatchSchema', () => {
  it('takes a named batch with its days and seats, the seats as typed in a field', () => {
    expect(academyBatchSchema.parse({ name: ' Level 1 ', startsOn: '2026-11-15', endsOn: '2026-11-17', seats: '12' })).toEqual({
      name: 'Level 1', startsOn: '2026-11-15', endsOn: '2026-11-17', seats: 12,
    });
  });

  it('refuses a batch that ends before it starts, or with no seats', () => {
    expect(academyBatchSchema.safeParse({ name: 'Level 1', startsOn: '2026-11-17', endsOn: '2026-11-15', seats: 12 }).success).toBe(false);
    expect(academyBatchSchema.safeParse({ name: 'Level 1', startsOn: '2026-11-15', endsOn: '2026-11-15', seats: 0 }).success).toBe(false);
  });
});

describe('companyBookingSchema', () => {
  it('takes the contact\'s number as typed, and 1 to 100 heads', () => {
    expect(companyBookingSchema.parse({ contactPhone: '90000 00203', companyName: 'Acme Pvt Ltd', seats: '3' })).toEqual({
      contactPhone: '+919000000203', companyName: 'Acme Pvt Ltd', seats: 3,
    });
    expect(companyBookingSchema.safeParse({ contactPhone: '9000000203', companyName: 'Acme Pvt Ltd', seats: 101 }).success).toBe(false);
  });
});
