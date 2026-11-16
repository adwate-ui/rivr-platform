// DigiLocker's delivery (#1023; decision 0676). Once a member submits on Zoop's gateway, Zoop posts their documents here,
// with the key it gave when the kyc function started the hand-off. Public, as nothing from Zoop carries a RIVR sign-in: the
// session is found by the header's key alone, and a request whose key names none is turned away before its body is read.
// What is kept for the kyc function's complete step is only what the check needs (record_kyc_digilocker's fields and the
// Aadhaar photo), never the documents; a delivery that cannot be read is kept as a refusal, so the member is not left
// waiting for it.
import { err, type Result } from '@rivr/contracts';
import type { AdapterFailure, DigiLockerRecord, KycAdapter } from '@rivr/adapters';
import { reasonOf, rpc } from '../kyc/server.ts';
import { zoopKyc } from '../kyc/zoop.ts';

// Zoop's delivery with both documents' PDFs came to about 280 KB (16 Nov 2026).
const MAX_BODY_BYTES = 2 * 1024 * 1024;

const UNREADABLE: AdapterFailure = { code: 'rejected', reason: 'Zoop unreadable' };

function answer(body: object, status: number): Response {
  return Response.json(body, { status });
}

/** The key Zoop puts on its delivery: it sends it under both spellings, and a proxy may drop the one with an underscore. */
function keyOf(request: Request): string | null {
  const key = request.headers.get('webhook-security-key') ?? request.headers.get('webhook_security_key');
  return key !== null && key.length >= 16 && key.length <= 200 ? key : null;
}

/** Why a request is turned away before anything is asked: not a POST, no key, or a body of no length or too long. */
function turnedAway(request: Request): Response | null {
  if (request.method !== 'POST') return answer({ error: 'POST only' }, 405);
  if (keyOf(request) === null) return answer({ error: 'No key' }, 401);
  const length = Number(request.headers.get('content-length') ?? '');
  return length > 0 && length <= MAX_BODY_BYTES ? null : answer({ error: 'Too large' }, 413);
}

/** What keep_kyc_digilocker_delivery takes: the record's fields, or why there is none. */
function keptAs(sessionId: string, key: string, outcome: Result<DigiLockerRecord, AdapterFailure>) {
  const none = { p_name: null, p_date_of_birth: null, p_masked_aadhaar: null, p_pan: null, p_address: null, p_photo: null, p_vendor_reference: null };
  if (!outcome.ok) return { p_session_id: sessionId, p_key: key, p_outcome: 'refused', ...none, p_refusal: reasonOf(outcome.error) };
  const { name, dateOfBirth, maskedAadhaar, pan, address, photoUrl, vendorReference } = outcome.value;
  return {
    p_session_id: sessionId, p_key: key, p_outcome: 'fetched', p_name: name, p_date_of_birth: dateOfBirth, p_masked_aadhaar: maskedAadhaar,
    p_pan: pan, p_address: address, p_photo: photoUrl, p_vendor_reference: vendorReference, p_refusal: null,
  };
}

/** The delivery for the session the key names: its body read only then, and kept against that session alone. */
async function deliver(kyc: Required<Pick<KycAdapter, 'readDigiLockerDelivery'>>, request: Request, key: string): Promise<Response> {
  const sessionId: unknown = await rpc('kyc_digilocker_session', { p_key: key }, null);
  if (typeof sessionId !== 'string') return answer({ error: 'unknown' }, 403);
  const delivery = kyc.readDigiLockerDelivery(await request.json().catch(() => null));
  // A body for another session than the key's is no delivery of this one.
  const outcome = delivery.ok && delivery.value.sessionId === sessionId ? delivery.value.outcome : err(UNREADABLE);
  const kept = await rpc('keep_kyc_digilocker_delivery', keptAs(sessionId, key, outcome), null);
  return kept === 'kept' ? answer({ ok: true }, 200) : answer({ error: 'unknown' }, 403);
}

Deno.serve(async (request) => {
  const early = turnedAway(request);
  if (early !== null) return early;
  const kyc = zoopKyc();
  if (kyc === undefined) return answer({ error: 'not_configured' }, 503);
  try {
    return await deliver(kyc, request, keyOf(request) ?? '');
  } catch {
    return answer({ error: 'unavailable' }, 502);
  }
});
