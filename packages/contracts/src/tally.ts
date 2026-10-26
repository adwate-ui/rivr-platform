import { z } from 'zod';

/** A money account code mapped to a ledger in the club's Tally company (#96): the ledger as Tally spells it. */
export const tallyLedgerSchema = z.object({
  accountCode: z.string().regex(/^[a-z_]+(\.[a-z_0-9]+)*$/),
  tallyLedger: z.string().trim().min(1).max(100),
});

export type TallyLedger = z.output<typeof tallyLedgerSchema>;
