import { z } from 'zod';
import { indianMobileSchema } from './identity.ts';
import { STAFF_ROLES } from './roles.ts';

/** A job title from the manpower plan (dealer, floor supervisor, cashier, host...): rosters use it, access does not. */
export const jobTitleSchema = z.string().trim().min(1).max(60);

/**
 * A staff member added on the console's Staff screen (#28): their name, job title, role, and the number
 * they sign in with. Only a dealer may have none (empty): dealers sign in on a tablet with a PIN, and no
 * one else has a PIN.
 */
export const staffAddSchema = z.object({
  fullName: z.string().trim().min(1).max(80),
  jobTitle: jobTitleSchema,
  role: z.enum(STAFF_ROLES),
  phone: z.union([z.literal('').transform(() => null), indianMobileSchema]),
}).refine((staff) => staff.phone !== null || staff.role === 'dealer', { path: ['phone'], message: 'needs a number' });
export type StaffAdd = z.output<typeof staffAddSchema>;

/** A staff member's job title, changed on its own. */
export const staffJobTitleSchema = z.object({ jobTitle: jobTitleSchema });
