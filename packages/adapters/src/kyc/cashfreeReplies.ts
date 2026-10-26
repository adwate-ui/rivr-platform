import { z } from 'zod';

// Cashfree Secure ID's replies, as its API reference documents them (#474); a field it leaves out may also
// come as null, as the sandbox sends name_match for an invalid PAN. Fields RIVR does not use are
// left out; a reply missing a field it does use is read as unavailable.

/** `POST /verification/digilocker`: where to send the member to consent, only ever a Cashfree page over https. */
export const digiLockerLinkSchema = z.object({
  url: z.string().url().refine((link) => {
    const url = new URL(link);
    return url.protocol === 'https:' && url.hostname.endsWith('.cashfree.com');
  }),
});

/** `GET /verification/digilocker/document/AADHAAR`. `uid` comes masked (`xxxxxxxx5647`); the photo is base64. */
export const digiLockerAadhaarSchema = z.object({
  status: z.string(),
  name: z.string().min(1),
  dob: z.string().min(1),
  uid: z.string().regex(/\d{4}$/),
  photo_link: z.string().min(1),
  split_address: z.record(z.string(), z.unknown()).nullish(),
});

/** `GET /verification/digilocker/document/PAN`, when the member's DigiLocker holds one. */
export const digiLockerPanSchema = z.object({ pan: z.string() });

/** `POST /verification/pan-lite`. */
export const panLiteSchema = z.object({
  status: z.string(),
  name_match: z.string().nullish(),
  dob_match: z.string().nullish(),
  reference_id: z.union([z.string(), z.number()]).nullish(),
});

/** `POST /verification/face-liveness`: `liveness_score` runs 0 to 1. */
export const livenessSchema = z.object({
  status: z.string(),
  liveness: z.boolean().nullish(),
  liveness_score: z.number().nullish(),
  ref_id: z.union([z.string(), z.number()]).nullish(),
});

/** `POST /verification/face-match`: `face_match_score` runs 0 to 1. */
export const faceMatchSchema = z.object({
  status: z.string(),
  face_match_result: z.string().nullish(),
  face_match_score: z.number().nullish(),
  ref_id: z.union([z.string(), z.number()]).nullish(),
});

// The address parts in the order they are written.
const ADDRESS_ORDER = ['house', 'street', 'landmark', 'vtc', 'po', 'subdist', 'dist', 'state', 'pincode'];

/** DigiLocker's address parts as one line: `12 Main Road, Sector 65, Gurugram, Haryana, 122018`. */
export function addressOf(parts: Readonly<Record<string, unknown>> | null | undefined): string {
  if (parts === undefined || parts === null) return '';
  return ADDRESS_ORDER.map((key) => parts[key]).filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    .map((part) => part.trim()).join(', ');
}

/** DigiLocker's date of birth (`02-02-1995`, or already `1995-02-02`) as an ISO date, or null. */
export function isoDateOf(dob: string): string | null {
  const dayFirst = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(dob.trim());
  if (dayFirst) return `${dayFirst[3]}-${dayFirst[2]}-${dayFirst[1]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(dob.trim()) ? dob.trim() : null;
}
