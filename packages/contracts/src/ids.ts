import { z } from 'zod';

// Each id is a uuid branded with its kind, so a MemberId cannot be passed where a VenueId is expected.

/** A venue's id. The practice venue is a venue too. */
export const venueIdSchema = z.uuid().brand<'VenueId'>();
/** A venue's id. */
export type VenueId = z.infer<typeof venueIdSchema>;

/** A member's id. */
export const memberIdSchema = z.uuid().brand<'MemberId'>();
/** A member's id. */
export type MemberId = z.infer<typeof memberIdSchema>;

/** A staff user's id. */
export const staffIdSchema = z.uuid().brand<'StaffId'>();
/** A staff user's id. */
export type StaffId = z.infer<typeof staffIdSchema>;

/** An enrolled device's id: a dealer tablet, the cage computer, a TV. */
export const deviceIdSchema = z.uuid().brand<'DeviceId'>();
/** An enrolled device's id. */
export type DeviceId = z.infer<typeof deviceIdSchema>;

/** A table's id, including the Private Room. */
export const tableIdSchema = z.uuid().brand<'TableId'>();
/** A table's id. */
export type TableId = z.infer<typeof tableIdSchema>;

/** A ledger account's id: a member's cash, the drop box, the jackpot pool. */
export const ledgerAccountIdSchema = z.uuid().brand<'LedgerAccountId'>();
/** A ledger account's id. */
export type LedgerAccountId = z.infer<typeof ledgerAccountIdSchema>;

/** A ledger transaction's id: one balanced set of ledger lines. */
export const ledgerTransactionIdSchema = z.uuid().brand<'LedgerTransactionId'>();
/** A ledger transaction's id. */
export type LedgerTransactionId = z.infer<typeof ledgerTransactionIdSchema>;

/**
 * The key a write carries so a retried tap or a replayed offline write lands once. Made on the
 * device when the write is first attempted, and enforced by a unique constraint in the database.
 */
export const idempotencyKeySchema = z.uuid().brand<'IdempotencyKey'>();
/** An idempotency key. */
export type IdempotencyKey = z.infer<typeof idempotencyKeySchema>;
