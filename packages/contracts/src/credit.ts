import { z } from 'zod';
import { indianMobileSchema } from './identity.ts';

/**
 * The floor manager's credit limit form (#73): the member's mobile number, the limit in whole rupees
 * (0 closes the line; the domain then checks ₹50 chips) and why.
 */
export const creditLimitSchema = z.object({
  phone: indianMobileSchema,
  limit: z.string().trim().regex(/^(0|[1-9]\d{0,7})$/),
  reason: z.string().trim().min(1).max(200),
});
