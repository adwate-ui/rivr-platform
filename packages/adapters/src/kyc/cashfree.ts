import { err, ok, panSchema, type Result } from '@rivr/contracts';
import { createCashfreeClient, parsed, type CashfreeClient, type CashfreeOptions } from '../shared/cashfree.ts';
import type { AdapterFailure } from '../shared/failure.ts';
import {
  addressOf, digiLockerAadhaarSchema, digiLockerLinkSchema, digiLockerPanSchema, faceMatchSchema, isoDateOf, livenessSchema, panLiteSchema,
} from './cashfreeReplies.ts';
import type { DigiLockerRecord, KycAdapter } from './types.ts';

// Face liveness names its API version; Cashfree's other Secure ID endpoints take none.
const LIVENESS_API_VERSION = '2024-12-01';
const UNAVAILABLE: AdapterFailure = { code: 'unavailable' };

/** A fresh id for each call: Cashfree refuses a `verification_id` it has seen. */
const verificationId = () => `rivr-${crypto.randomUUID()}`;

/** An image to send: a stored selfie's signed link, or DigiLocker's photo as a `data:` URL. */
async function imageAt(url: string, doFetch: typeof globalThis.fetch): Promise<Blob | null> {
  try {
    const response = await doFetch(url);
    return response.ok ? await response.blob() : null;
  } catch {
    return null;
  }
}

/** DigiLocker's record: the Aadhaar's, and the PAN's when the member's DigiLocker holds one. */
async function pullRecord(client: CashfreeClient, sessionId: string): Promise<Result<DigiLockerRecord, AdapterFailure>> {
  const query = `?verification_id=${encodeURIComponent(sessionId)}`;
  const aadhaar = parsed(digiLockerAadhaarSchema, await client.request({ method: 'GET', path: `/verification/digilocker/document/AADHAAR${query}` }));
  if (!aadhaar.ok) return aadhaar;
  const dateOfBirth = isoDateOf(aadhaar.value.dob);
  if (aadhaar.value.status !== 'SUCCESS' || dateOfBirth === null) return err({ code: 'rejected', reason: `Cashfree DigiLocker ${aadhaar.value.status}` });
  const pan = parsed(digiLockerPanSchema, await client.request({ method: 'GET', path: `/verification/digilocker/document/PAN${query}` }));
  const panNumber = pan.ok ? panSchema.safeParse(pan.value.pan.toUpperCase()) : null;
  return ok({
    name: aadhaar.value.name.trim(),
    dateOfBirth,
    maskedAadhaar: `XXXX XXXX ${aadhaar.value.uid.slice(-4)}`,
    // Cashfree gives no stable reference for an Aadhaar number: the database finds duplicates by name, date
    // of birth and the last four digits instead (decision 0197).
    aadhaarReference: null,
    pan: panNumber?.success ? panNumber.data : null,
    address: addressOf(aadhaar.value.split_address),
    photoUrl: `data:image/jpeg;base64,${aadhaar.value.photo_link}`,
    vendorReference: sessionId,
  });
}

/** Liveness and the 1:1 match, sent as image files. Cashfree has no 1:N face search, so there is no `enrolFace`. */
function faceChecks(client: CashfreeClient, doFetch: typeof globalThis.fetch): Pick<KycAdapter, 'checkLiveness' | 'matchFace'> {
  return {
    async checkLiveness({ selfieUrl }) {
      const selfie = await imageAt(selfieUrl, doFetch);
      if (selfie === null) return err(UNAVAILABLE);
      const form = new FormData();
      const id = verificationId();
      form.append('verification_id', id);
      form.append('image', selfie, 'selfie.jpg');
      const reply = parsed(livenessSchema, await client.request({ method: 'POST', path: '/verification/face-liveness', form, apiVersion: LIVENESS_API_VERSION }));
      if (!reply.ok) return reply;
      const isLive = reply.value.status === 'SUCCESS' && reply.value.liveness === true;
      return ok({ isLive, score: Math.round((reply.value.liveness_score ?? 0) * 100), vendorReference: String(reply.value.ref_id ?? id) });
    },
    async matchFace({ selfieUrl, referenceUrl }) {
      const [selfie, reference] = await Promise.all([imageAt(selfieUrl, doFetch), imageAt(referenceUrl, doFetch)]);
      if (selfie === null || reference === null) return err(UNAVAILABLE);
      const form = new FormData();
      const id = verificationId();
      form.append('verification_id', id);
      form.append('first_image', selfie, 'selfie.jpg');
      form.append('second_image', reference, 'aadhaar.jpg');
      const reply = parsed(faceMatchSchema, await client.request({ method: 'POST', path: '/verification/face-match', form }));
      if (!reply.ok) return reply;
      const isMatch = reply.value.status === 'SUCCESS' && reply.value.face_match_result === 'YES';
      return ok({ isMatch, score: Math.round((reply.value.face_match_score ?? 0) * 100), vendorReference: String(reply.value.ref_id ?? id) });
    },
  };
}

/**
 * KYC on Cashfree Secure ID (#474; decision 0197): DigiLocker for the Aadhaar and PAN, the PAN check with a
 * name match, selfie liveness and the match with the Aadhaar photo. The sandbox answers only Cashfree's
 * published test values (docs: data to test integration).
 */
export function createCashfreeKyc(options: CashfreeOptions): KycAdapter {
  const client = createCashfreeClient(options);
  const doFetch = options.fetch ?? globalThis.fetch;
  return {
    async startDigiLocker({ returnUrl }) {
      const id = verificationId();
      const reply = parsed(digiLockerLinkSchema, await client.request({
        method: 'POST', path: '/verification/digilocker',
        json: { verification_id: id, document_requested: ['AADHAAR', 'PAN'], redirect_url: returnUrl, user_flow: 'signup' },
      }));
      return reply.ok ? ok({ sessionId: id, redirectUrl: reply.value.url }) : reply;
    },
    pullDigiLocker: ({ sessionId }) => pullRecord(client, sessionId),
    async verifyPan({ pan, name, dateOfBirth }) {
      const id = verificationId();
      const reply = parsed(panLiteSchema, await client.request({
        method: 'POST', path: '/verification/pan-lite', json: { verification_id: id, pan, name, dob: dateOfBirth },
      }));
      if (!reply.ok) return reply;
      return ok({
        isValid: reply.value.status === 'VALID', nameMatches: reply.value.name_match === 'Y', dateOfBirthMatches: reply.value.dob_match === 'Y',
        vendorReference: String(reply.value.reference_id ?? id),
      });
    },
    ...faceChecks(client, doFetch),
  };
}
