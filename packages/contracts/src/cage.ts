import { z } from 'zod';
import { utrSchema } from './payments.ts';

/** How a cashier takes a buy-in (#57). */
export const BUY_IN_METHODS = ['cash', 'upi', 'wallet'] as const;
export type BuyInMethodKey = (typeof BUY_IN_METHODS)[number];

/**
 * The cage's buy-in form: whole rupees (the domain then checks ₹50 chips, the table's minimum and the
 * wallet), the method, and for UPI its twelve-digit UTR.
 */
export const cageBuyInSchema = z
  .object({
    amount: z.string().trim().regex(/^[1-9]\d{0,7}$/),
    method: z.enum(BUY_IN_METHODS),
    utr: z.string().trim(),
  })
  .superRefine((value, context) => {
    if (value.method === 'upi' && !utrSchema.safeParse(value.utr).success) {
      context.addIssue({ code: 'custom', path: ['utr'], message: 'A UPI buy-in needs its 12-digit UTR' });
    }
  });
