import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  deviceIdSchema,
  idempotencyKeySchema,
  ledgerAccountIdSchema,
  ledgerTransactionIdSchema,
  memberIdSchema,
  staffIdSchema,
  tableIdSchema,
  venueIdSchema,
  type MemberId,
  type VenueId,
} from './ids.ts';

const UUID = '3f2b8c4e-9d1a-4b6f-8e2c-7a5d9f0b1c3e';

describe('branded ids', () => {
  it.each([
    ['venue', venueIdSchema],
    ['member', memberIdSchema],
    ['staff', staffIdSchema],
    ['device', deviceIdSchema],
    ['table', tableIdSchema],
    ['ledger account', ledgerAccountIdSchema],
    ['ledger transaction', ledgerTransactionIdSchema],
    ['idempotency key', idempotencyKeySchema],
  ])('accepts a uuid as a %s id and rejects anything else', (_name, schema) => {
    expect(schema.parse(UUID)).toBe(UUID);
    expect(schema.safeParse('table-3').success).toBe(false);
    expect(schema.safeParse('').success).toBe(false);
    expect(schema.safeParse(42).success).toBe(false);
  });

  it('keeps one kind of id from being passed as another', () => {
    const member: MemberId = memberIdSchema.parse(UUID);
    // @ts-expect-error A member id is not a venue id, even with the same uuid.
    const venue: VenueId = member;

    expectTypeOf<VenueId>().not.toEqualTypeOf<MemberId>();
    expect(venue).toBe(UUID);
  });
});
