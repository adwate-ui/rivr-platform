import { z } from 'zod';

// A document number never goes in a reason: twelve digits as an Aadhaar has, or a PAN's shape. The
// database refuses the same (kyc_review.reason).
const AADHAAR_LIKE = /[0-9]{4}[^0-9]?[0-9]{4}[^0-9]?[0-9]{4}/;
const PAN_LIKE = /[a-z]{5}[0-9]{4}[a-z]/i;
const PAN = /^[A-Z]{3}[ABCFGHJLPT][A-Z][0-9]{4}[A-Z]$/;

/** An empty field is "not given". */
const notGiven = (value: string) => (value === '' ? undefined : value);

/**
 * A KYC reviewer's decision, as the console's form gives it: the reason in their own words, never a
 * document number; and the date of birth and PAN from the original documents, given only where the
 * check kept none (empty otherwise).
 */
export const kycReviewSchema = z.object({
  reason: z.string().trim().min(3).max(500)
    .refine((reason) => !AADHAAR_LIKE.test(reason) && !PAN_LIKE.test(reason), { message: 'no document numbers' }),
  dateOfBirth: z.union([z.literal(''), z.iso.date()]).transform(notGiven),
  pan: z.string().trim().toUpperCase().refine((pan) => pan === '' || PAN.test(pan)).transform(notGiven),
});

/**
 * A check in person at the club (#246), as the console sends it with the member's photo: the date of
 * birth and PAN from the originals, only the last four Aadhaar digits (never the whole number), and
 * the member's consent, given there. The database checks the same.
 */
export const kycInPersonSchema = z.object({
  memberId: z.uuid(),
  dateOfBirth: z.iso.date(),
  aadhaarLast4: z.string().trim().regex(/^[0-9]{4}$/),
  pan: z.string().trim().toUpperCase().regex(PAN),
  consent: z.literal(true),
});

export type KycInPerson = z.output<typeof kycInPersonSchema>;
