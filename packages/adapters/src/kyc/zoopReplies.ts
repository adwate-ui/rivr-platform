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

// A DigiLocker session's id, as Zoop gives it (24 hex digits on 16 Nov 2026); it goes into a path, so nothing else is taken.
export const sessionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);

/** `POST /identity/digilocker/v1/init` (decision 0676): the session, the key its webhook carries, and the gateway. */
export const digiLockerInitSchema = z.object({
  request_id: sessionIdSchema,
  webhook_security_key: z.string().min(16).max(200),
  // The member is sent here: Zoop's own gateway only (gateway.zoop.plus on 16 Nov 2026).
  sdk_url: z.url({ protocol: /^https$/, hostname: /(^|\.)zoop\.(plus|one)$/ }),
});

/** `GET /identity/digilocker/v1/fetch/<id>`: INITIATED, then SUCCESS once the member has submitted. No documents. */
export const digiLockerFetchSchema = z.object({
  transaction_status: z.string(),
});

/**
 * The webhook Zoop sends to `response_url` once the member submits, as Zoop's DigiLocker documentation and a test-host run
 * (16 Nov 2026) have it: each document asked for, FETCHED with its XML or SKIPPED when DigiLocker held none.
 */
export const digiLockerDeliverySchema = z.object({
  request_id: sessionIdSchema,
  success: z.boolean(),
  response_code: z.union([z.string(), z.number()]).transform(String),
  metadata: z.object({ reason_code: z.string().nullish() }).nullish(),
  result: z.array(z.object({ doctype: z.string(), status: z.string(), data_xml: z.string().nullish() })).nullish(),
});

/** `POST /api/v1/in/ml/face/match`, when the faces are the same person: `face_match_score` runs 0 to 100, as a string. */
export const faceMatchSchema = z.object({
  face_match_score: z.union([z.string().regex(/^\d{1,3}(\.\d+)?$/), z.number()]).transform(Number).pipe(z.number().min(0).max(100)),
});
