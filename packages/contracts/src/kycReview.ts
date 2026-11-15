import { z } from 'zod';

// A document number never goes in a reason: twelve digits as an Aadhaar has, or a PAN's shape. The
// database refuses the same (kyc_review.reason).
const AADHAAR_LIKE = /[0-9]{4}[^0-9]?[0-9]{4}[^0-9]?[0-9]{4}/;
const PAN_LIKE = /[a-z]{5}[0-9]{4}[a-z]/i;
const PAN = /^[A-Z]{3}[ABCFGHJLPT][A-Z][0-9]{4}[A-Z]$/;

// A reason the audit log keeps for good holds no digit at all, Devanagari included (reopen_kyc_check, ask_kyc_document_retake).
const ANY_DIGIT = /[0-9०-९]/;

/**
 * Whether a reason is in words: three characters at least, `max` at most, and no digit. The database asks the same of a
 * reopened check (500) and of a photo sent back (200), so the form says so before anything is sent.
 */
export function isReasonInWords(reason: string, max: number): boolean {
  const length = reason.trim().length;
  return length >= 3 && length <= max && !ANY_DIGIT.test(reason);
}

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
  /**
   * The staff member's word that the bars on the Aadhaar photo hide its first eight digits and QR code (decision 0573), asked
   * for only while the venue's kyc.aadhaar_covers is on (decision 0663); the database decides.
   */
  coversConfirmed: z.boolean(),
});

export type KycInPerson = z.output<typeof kycInPersonSchema>;

/** The documents photographed at the desk (decision 0573). */
export const KYC_DOCUMENT_KINDS = ['pan', 'aadhaar_front'] as const;

export type KycDocumentKind = (typeof KYC_DOCUMENT_KINDS)[number];

/** A photo a super admin sent back, taken again at the desk. A new Aadhaar photo needs the word on its bars while the venue asks for them. */
export const kycDocumentRetakeSchema = z.object({
  memberId: z.uuid(),
  kind: z.enum(KYC_DOCUMENT_KINDS),
  coversConfirmed: z.boolean(),
});

export type KycDocumentRetake = z.output<typeof kycDocumentRetakeSchema>;
