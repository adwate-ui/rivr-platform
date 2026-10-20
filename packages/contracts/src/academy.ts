import { z } from 'zod';
import { gstinSchema, indianMobileSchema } from './identity.ts';

/** A new Academy batch, as the console opens one: a name, its first and last days, and 1 to 500 seats. */
export const academyBatchSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    startsOn: z.iso.date(),
    endsOn: z.iso.date(),
    seats: z.coerce.number().int().min(1).max(500),
  })
  .refine((batch) => batch.endsOn >= batch.startsOn, { path: ['endsOn'] });

/**
 * A company's Academy booking: the contact's mobile number (a member of the venue), the company, 1 to 100 heads,
 * and the company's GSTIN for its invoice (#249), empty when it has none.
 */
export const companyBookingSchema = z.object({
  contactPhone: indianMobileSchema,
  companyName: z.string().trim().min(1).max(200),
  seats: z.coerce.number().int().min(1).max(100),
  companyGstin: z.union([z.literal(''), gstinSchema]),
});
