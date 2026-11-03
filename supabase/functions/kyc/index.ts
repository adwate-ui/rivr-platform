// KYC for the signed-in member (#4, #5): the selfie, the DigiLocker hand-off and its return, and a
// PAN check when DigiLocker fails; and the photo a member gives at sign-up (#631). The practice venue gets the fake vendor; a real venue without
// vendor keys fails closed (docs/decisions/0014). This function writes the member's kyc_record with
// the service role; members can only read it, so nobody verifies themselves. Every vendor call first
// passes begin_kyc_vendor_call: the kyc_signup kill switch, the member's consent, five paid calls a day.
import { panSchema } from '@rivr/contracts';
import { kycIdentityKey } from '@rivr/domain/identity';
import { takeSignUpPhoto } from './photo.ts';
import { takeSelfie } from './selfie.ts';
import { CORS, currentRecord, failed, field, noteFailure, photoUrl, refusal, reply, rpc } from './server.ts';
import { subjectFor, type Subject } from './subject.ts';

// A selfie of at most 2 MB, in base64, and the rest of the body.
const MAX_BODY_BYTES = 3 * 1024 * 1024;

/** An app's own origin, https (http only on this machine), with nothing after it. */
function isAppOrigin(url: URL): boolean {
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const isSecure = url.protocol === 'https:' || (url.protocol === 'http:' && isLocal);
  return isSecure && url.pathname === '/' && url.search === '' && url.hash === '' && url.username === '' && url.password === '';
}

/**
 * Where DigiLocker sends the member back: /kyc/return on the player app's own address, fixed here and never taken from the
 * request, so the hand-off cannot be pointed at someone else's page. The address is the app's https origin alone (http
 * only on this machine), as Cashfree refuses any other return (K-08: staging's was not, and every start failed); one that
 * is not is no return address at all.
 */
function returnUrlOf(appUrl: string): string | null {
  try {
    const url = new URL(appUrl);
    return isAppOrigin(url) ? new URL('/kyc/return', url.origin).href : null;
  } catch {
    return null;
  }
}

const returnUrl = returnUrlOf(Deno.env.get('PLAYER_APP_URL') ?? '');

/** The DigiLocker hand-off, once the selfie is in: the gate passes, then the vendor is called. */
async function start({ memberId, kyc }: Subject): Promise<Response> {
  if (returnUrl === null) return reply({ error: 'not_configured' }, 503);
  const record = await currentRecord(memberId);
  const canStart = record?.status === 'started' || record?.status === 'needs_pan';
  if (!canStart || typeof record?.photo_path !== 'string') return reply({ error: 'The selfie comes first' }, 409);
  await rpc('begin_kyc_vendor_call', { p_member_id: memberId, p_is_paid: true }, null);
  const started = await kyc.startDigiLocker({ memberId, returnUrl });
  if (!started.ok) return await failed(memberId, 'start', started.error);
  await rpc('record_kyc_started', { p_member_id: memberId, p_session_id: started.value.sessionId }, null);
  return reply({ redirectUrl: started.value.redirectUrl });
}

/**
 * The member is back from DigiLocker: pull the record and match its photo against the selfie, or
 * move them to a PAN check. The member's face verifies them at once, whatever name they registered
 * (decision 0400); a face that is not theirs means someone else's Aadhaar: the check waits for staff.
 */
async function complete({ memberId, kyc }: Subject): Promise<Response> {
  const record = await currentRecord(memberId);
  const session = record?.digilocker_session_id;
  if (typeof session !== 'string' || typeof record?.photo_path !== 'string') return reply({ error: 'No DigiLocker hand-off to complete' }, 409);
  if (record.status !== 'started') return reply({ status: record.status });
  // The pull and the face match are paid: they count against the five a day.
  await rpc('begin_kyc_vendor_call', { p_member_id: memberId, p_is_paid: true }, null);
  const pulled = await kyc.pullDigiLocker({ sessionId: session });
  if (!pulled.ok && pulled.error.code === 'not_configured') return await failed(memberId, 'complete', pulled.error);
  if (!pulled.ok) {
    // DigiLocker not finished, or refused: why is kept, and the member goes on to a PAN check.
    await noteFailure(memberId, 'complete', pulled.error);
    await rpc('record_kyc_digilocker_failed', { p_member_id: memberId }, null);
    return reply({ status: 'needs_pan' });
  }
  const face = await kyc.matchFace({ selfieUrl: await photoUrl(record.photo_path), referenceUrl: pulled.value.photoUrl });
  if (!face.ok) return await failed(memberId, 'complete', face.error);
  const { name, dateOfBirth, maskedAadhaar, aadhaarReference, pan, address, vendorReference } = pulled.value;
  const status = await rpc('record_kyc_digilocker', {
    p_member_id: memberId, p_date_of_birth: dateOfBirth, p_masked_aadhaar: maskedAadhaar, p_aadhaar_reference: aadhaarReference,
    p_pan: pan, p_address: address, p_vendor_reference: vendorReference,
    p_face_matches: face.value.isMatch, p_face_match_score: Math.round(face.value.score),
    // Duplicates by the document's name, date of birth and last four digits (decision 0197).
    p_identity_key: kycIdentityKey(name, dateOfBirth, maskedAadhaar),
    // The Aadhaar's name becomes the member's once verified; the one they gave stays as what they are known as (#803).
    p_name: name,
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
 * A PAN check, when DigiLocker failed (or, for a check from before decision 0400, held no PAN). The
 * PAN is checked against the member's registered name, never one from the request; the date of birth
 * is DigiLocker's when it gave one.
 */
async function checkPan({ memberId, fullName, kyc }: Subject, body: unknown): Promise<Response> {
  const record = await currentRecord(memberId);
  if (record?.status !== 'needs_pan') return reply({ error: 'No PAN is needed' }, 409);
  const input = panInput(record, body);
  if (input === null) return reply({ error: 'pan and dateOfBirth are required' }, 400);
  const { pan, dateOfBirth } = input;
  await rpc('begin_kyc_vendor_call', { p_member_id: memberId, p_is_paid: true }, null);
  const checked = await kyc.verifyPan({ pan, name: fullName, dateOfBirth });
  if (!checked.ok) return await failed(memberId, 'pan', checked.error);
  const { isValid, nameMatches, dateOfBirthMatches } = checked.value;
  if (!isValid || !nameMatches || !dateOfBirthMatches) return reply({ error: 'pan_rejected' }, 422);
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
  if (action === 'photo') return await takeSignUpPhoto(subject, token, body);
  return reply({ error: 'action must be selfie, start, complete, pan or photo' }, 400);
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
