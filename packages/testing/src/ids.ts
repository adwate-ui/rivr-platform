import {
  deviceIdSchema,
  idempotencyKeySchema,
  ledgerAccountIdSchema,
  ledgerTransactionIdSchema,
  memberIdSchema,
  staffIdSchema,
  tableIdSchema,
  venueIdSchema,
} from '@rivr/contracts';

let issued = 0;

/**
 * A valid uuid that no other call returns: `7e570000-0000-4000-8000-000000000001`, then `…002`.
 * Seed ids start `5eed`, so the two never collide.
 */
export function nextTestUuid(): string {
  issued += 1;
  return `7e570000-0000-4000-8000-${issued.toString(16).padStart(12, '0')}`;
}

/** A fresh branded id of each kind for tests: `newId.member()`. */
export const newId = {
  venue: () => venueIdSchema.parse(nextTestUuid()),
  member: () => memberIdSchema.parse(nextTestUuid()),
  staff: () => staffIdSchema.parse(nextTestUuid()),
  device: () => deviceIdSchema.parse(nextTestUuid()),
  table: () => tableIdSchema.parse(nextTestUuid()),
  ledgerAccount: () => ledgerAccountIdSchema.parse(nextTestUuid()),
  ledgerTransaction: () => ledgerTransactionIdSchema.parse(nextTestUuid()),
  idempotencyKey: () => idempotencyKeySchema.parse(nextTestUuid()),
};
