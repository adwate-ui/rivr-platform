// KYC for the signed-in member (#4, #5): the selfie, the DigiLocker hand-off and its return, and a
// PAN check when DigiLocker fails. The practice venue gets the fake vendor; a real venue without
// vendor keys fails closed (docs/decisions/0014). This function writes the member's kyc_record with
// the service role; members can only read it, so nobody verifies themselves. Every vendor call first
// passes begin_kyc_vendor_call: the kyc_signup kill switch, the member's consent, five paid calls a day.
import { panSchema } from '@rivr/contracts';
import { isSameName } from '@rivr/domain/identity';
import { takeSelfie } from './selfie.ts';
import { CORS, currentRecord, failed, field, photoUrl, refusal, reply, rpc } from './server.ts';
import { subjectFor, type Subject } from './subject.ts';

// A selfie of at most 2 MB, in base64, and the rest of the body.
const MAX_BODY_BYTES = 3 * 1024 * 1024;

// Where DigiLocker sends the member back. Fixed here, never taken from the request, so the hand-off
// cannot be pointed at someone else's page.
const playerAppUrl = Deno.env.get('PLAYER_APP_URL') ?? '';

/** The DigiLocker hand-off, once the selfie is in: the gate passes, then the vendor is called. */
async function start({ memberId, kyc }: Subject): Promise<Response> {
  if (playerAppUrl === '') return reply({ error: 'not_configured' }, 503);
  const record = await currentRecord(memberId);
  const canStart = record?.status === 'started' || record?.status === 'needs_pan';
  if (!canStart || typeof record?.photo_path !== 'string') return reply({ error: 'The selfie comes first' }, 409);
  await rpc('begin_kyc_vendor_call', { p_member_id: memberId, p_is_paid: true }, null);
  const started = await kyc.startDigiLocker({ memberId, returnUrl: `${playerAppUrl}/kyc/return` });
  if (!started.ok) return failed(started.error);
  await rpc('record_kyc_started', { p_member_id: memberId, p_session_id: started.value.sessionId }, null);
  return reply({ redirectUrl: started.value.redirectUrl });
}

/**
 * The member is back from DigiLocker: pull the record and match its photo against the selfie, or
 * move them to a PAN check. A name or a face that is not the member's means someone else's documents:
 * the check waits for staff.
 */
async function complete({ memberId, fullName, kyc }: Subject): Promise<Response> {
  const record = await currentRecord(memberId);
  const session = record?.digilocker_session_id;
  if (typeof session !== 'string' || typeof record?.photo_path !== 'string') return reply({ error: 'No DigiLocker hand-off to complete' }, 409);
  if (record.status !== 'started') return reply({ status: record.status });
  // The pull and the face match are paid: they count against the five a day.
  await rpc('begin_kyc_vendor_call', { p_member_id: memberId, p_is_paid: true }, null);
  const pulled = await kyc.pullDigiLocker({ sessionId: session });
  if (!pulled.ok && pulled.error.code === 'not_configured') return failed(pulled.error);
  if (!pulled.ok) {
    await rpc('record_kyc_digilocker_failed', { p_member_id: memberId }, null);
    return reply({ status: 'needs_pan' });
  }
  const face = await kyc.matchFace({ selfieUrl: await photoUrl(record.photo_path), referenceUrl: pulled.value.photoUrl });
  if (!face.ok) return failed(face.error);
  const { name, dateOfBirth, maskedAadhaar, aadhaarReference, pan, address, vendorReference } = pulled.value;
  const status = await rpc('record_kyc_digilocker', {
    p_member_id: memberId, p_date_of_birth: dateOfBirth, p_masked_aadhaar: maskedAadhaar, p_aadhaar_reference: aadhaarReference,
    p_pan: pan, p_address: address, p_vendor_reference: vendorReference, p_name_matches: isSameName(name, fullName),
    p_face_matches: face.value.isMatch, p_face_match_score: Math.round(face.value.score),
  }, null);
  return reply({ status });
}

/**
 * The PAN to check, and the date of birth: after DigiLocker always DigiLocker's, never one typed in;
 * after a failed DigiLocker the member's own, which leaves the check for staff.
 */
function panInput(record: Record<string, unknown>, body: unknown) {
  const pan = panSchema.safeParse(field(body, 'pan') ?? '');
  const dateOfBirth = record.method === 'digilocker' ? record.date_of_birth : field(body, 'dateOfBirth');
  if (typeof dateOfBirth !== 'string') return null;
  if (!pan.success || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  return { pan: pan.data, dateOfBirth };
}

/**
 * A PAN check, when DigiLocker failed or held no PAN. The PAN is checked against the member's
 * registered name, never one from the request; the date of birth is DigiLocker's when it gave one.
 */
async function checkPan({ memberId, fullName, kyc }: Subject, body: unknown): Promise<Response> {
  const record = await currentRecord(memberId);
  if (record?.status !== 'needs_pan') return reply({ error: 'No PAN is needed' }, 409);
  const input = panInput(record, body);
  if (input === null) return reply({ error: 'pan and dateOfBirth are required' }, 400);
  const { pan, dateOfBirth } = input;
  await rpc('begin_kyc_vendor_call', { p_member_id: memberId, p_is_paid: true }, null);
  const checked = await kyc.verifyPan({ pan, name: fullName, dateOfBirth });
  if (!checked.ok) return failed(checked.error);
  if (!checked.value.isValid || !checked.value.nameMatches) return reply({ error: 'pan_rejected' }, 422);
  const status = await rpc('record_kyc_pan', {
    p_member_id: memberId, p_pan: pan, p_date_of_birth: dateOfBirth, p_vendor_reference: checked.value.vendorReference,
  }, null);
  return reply({ status });
}

/** Runs the step the body names. */
async function act(subject: Subject, token: string, body: unknown): Promise<Response> {
  const action = field(body, 'action');
  if (action === 'selfie') return await takeSelfie(subject, token, body);
  if (action === 'start') return await start(subject);
  if (action === 'complete') return await complete(subject);
  if (action === 'pan') return await checkPan(subject, body);
  return reply({ error: 'action must be selfie, start, complete or pan' }, 400);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'POST') return reply({ error: 'POST only' }, 405);
  // A body without its length, or a longer one, is refused before it is read.
  const length = request.headers.get('content-length');
  if (length === null || length === '' || !(Number(length) <= MAX_BODY_BYTES)) return reply({ error: 'Too large' }, 413);
  const token = request.headers.get('authorization') ?? '';
  // Who is asking before anything else is read.
  const subject = await subjectFor(token);
  if (subject === null) return reply({ error: 'Only a signed-in member has KYC' }, 403);
  const body: unknown = await request.json().catch(() => null);
  try {
    return await act(subject, token, body);
  } catch (error) {
    return refusal(error);
  }
});
