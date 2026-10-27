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

/** A time of day on India's 24-hour clock, as the roster writes it: `18:00`. */
export const clockTimeSchema = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/**
 * Shifts for some staff on some days, from a start to an end (#106, decision 0236): an end at or before the start is
 * the next morning. `private.add_shifts` checks the same.
 */
export const rosterShiftsSchema = z.object({
  staffIds: z.array(z.uuid()).min(1).max(200),
  days: z.array(z.iso.date()).min(1).max(14),
  starts: clockTimeSchema,
  ends: clockTimeSchema,
});
export type RosterShifts = z.output<typeof rosterShiftsSchema>;
