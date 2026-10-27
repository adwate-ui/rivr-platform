import { z } from 'zod';

/** What a creator's commission is paid on (#163): a member who signed up with their code finishing KYC, coming in, or buying in. */
export const COMMISSION_BASES = ['kyc', 'first_visit', 'first_buy_in'] as const;
export type CommissionBasis = (typeof COMMISSION_BASES)[number];

/** A new creator as the console takes it: a name, the code their links carry, and a commission in whole rupees at its basis. */
export const newCreatorSchema = z.object({
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().regex(/^[A-Za-z0-9_.+-]{2,32}$/),
  basis: z.enum(COMMISSION_BASES),
  commission: z.string().trim().regex(/^(0|[1-9]\d{0,6})$/),
});
