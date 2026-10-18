import { z } from 'zod';

/**
 * A KYC reviewer's decision, as the console's form gives it: the reason in their own words, and the
 * date of birth on the original document, given only where the check kept none (empty otherwise).
 */
export const kycReviewSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  dateOfBirth: z
    .union([z.literal(''), z.iso.date()])
    .transform((value) => (value === '' ? undefined : value)),
});
