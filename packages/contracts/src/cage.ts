import { z } from 'zod';
import { utrSchema } from './payments.ts';

/** Where a cash-out goes (#75), once open markers are settled. */
export const CASH_OUT_TO = ['cash', 'wallet'] as const;

/**
 * The cage's cash-out form (#75): the chips in whole rupees (the domain then checks ₹50 chips), where they go, and
 * whether it is final, the member leaving the club (#76).
 */
export const cashOutSchema = z.object({ amount: z.string().trim().regex(/^[1-9]\d{0,7}$/), to: z.enum(CASH_OUT_TO), isFinal: z.boolean() });

/** How a cashier takes a buy-in (#57). */
export const BUY_IN_METHODS = ['cash', 'upi', 'wallet', 'bonus'] as const;
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

/** How many of one chip, as typed: a whole number from 0 (#24). */
const chipQuantitySchema = z.string().trim().regex(/^(0|[1-9]\d{0,5})$/);

/** A count of the chips in the cage (#24): how many of each of the venue's chips, in their order. */
export const chipCountSchema = z.object({ quantities: z.array(chipQuantitySchema).min(1) });

/** Opening the cage's shift (#24): the float counted into the drawer, in whole rupees, and the chips counted. */
export const openShiftSchema = chipCountSchema.extend({ float: z.string().trim().regex(/^(0|[1-9]\d{0,8})$/) });