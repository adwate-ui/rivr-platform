import { z } from 'zod';

// Zoop.one's replies (decision 0671). The envelope and Face Match are as Zoop's test host answered on 15 Nov 2026; the
// PAN products as Zoop's 2022 documentation shows them, until they are on RIVR's account and answer for themselves.
// Fields RIVR does not use are left out; a reply missing a field it does use is read as unavailable.

/**
 * Every reply. `response_code` comes as a string (`"100"`) or, on a refused key, a number (`401`), so it is read as a
 * string. `request_id` is Zoop's own id for the call. A refused key's reply has only the code and its message.
 */
export const envelopeSchema = z.object({
  request_id: z.string().nullish(),
  response_code: z.union([z.string(), z.number()]).transform(String),
  result: z.unknown().optional(),
});

/** `POST /api/v1/in/identity/pan/lite`: `pan_status` is `Valid` (`VALID` in other PAN products) for a live PAN. */
export const panLiteSchema = z.object({
  pan_status: z.string(),
  user_full_name: z.string(),
});

/** `POST /api/v1/in/identity/pan/demographic`: whether the date of birth sent is the PAN's. */
export const panDemographicSchema = z.object({
  is_dob_match: z.boolean(),
});

/** `POST /api/v1/in/ml/face/match`, when the faces are the same person: `face_match_score` runs 0 to 100, as a string. */
export const faceMatchSchema = z.object({
  face_match_score: z.union([z.string().regex(/^\d{1,3}(\.\d+)?$/), z.number()]).transform(Number).pipe(z.number().min(0).max(100)),
});
