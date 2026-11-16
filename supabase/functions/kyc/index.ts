// KYC for the signed-in member (#4, #5): the selfie, the DigiLocker hand-off and its return, and a
// PAN check when DigiLocker fails; and the photo a member gives at sign-up (#631). The practice venue gets the fake vendor; a real venue without
// vendor keys fails closed (docs/decisions/0014). This function writes the member's kyc_record with
// the service role; members can only read it, so nobody verifies themselves. Every vendor call first
// passes begin_kyc_vendor_call: the kyc_signup kill switch, the member's consent, five paid calls a day.
import type { AdapterFailure, DigiLockerRecord, FaceMatch, KycAdapter } from '@rivr/adapters';
import { panSchema } from '@rivr/contracts';
import { kycIdentityKey } from '@rivr/domain/identity';
import { digiLockerRecord } from './digilocker.ts';
import { takeSignUpPhoto } from './photo.ts';
import { takeSelfie } from './selfie.ts';
import { CORS, currentRecord, failed, failureReply, field, giveBackCall, noteFailure, photoUrl, refusal, reply, rpc, type KycStep } from './server.ts';
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
 * only on this machine), as Cashfree refused any other return (K-08: staging's was not, and every start failed); one that
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

// Where a vendor that delivers DigiLocker's documents sends them (Zoop, decision 0676): kyc-digilocker, on this project.
const deliveryUrl = `${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/kyc-digilocker`;

/** Why a check waits for the desk, as kyc_record keeps it for the desk to see (decision 0678). */
type DeskReason = 'face_unconfirmed' | 'no_date_of_birth' | 'digilocker_failed' | 'not_started';

/** Zoop did not verify the member: what the desk is told, the failure noted with the check, and Zoop's face score if any. */
interface Unverified {
  readonly deskReason: DeskReason;
  readonly failure: AdapterFailure;
  readonly faceMatchScore?: number;
}

/**
 * Zoop did not verify the member (the owner, 16 Nov 2026; decision 0678): the check waits for the desk, as while the venue
 * checks identity at the club, with why kept for the desk. `at_club`, or null when the check was not one in progress.
 */
async function toTheDesk(memberId: string, step: KycStep, { deskReason, failure, faceMatchScore }: Unverified): Promise<Response | null> {
  await noteFailure(memberId, step, failure);
  const args = { p_member_id: memberId, p_reason: deskReason, p_face_match_score: faceMatchScore ?? null };
  const isAtTheDesk = (await rpc('record_kyc_digilocker_failed', args, null)) === true;
  return isAtTheDesk ? reply({ status: 'at_club' }) : null;
}

/**
 * The DigiLocker hand-off, once the selfie is in: the gate passes, then the vendor is called. When Zoop cannot start it (down,
 * no keys, refusing), the paid call is given back where it was the vendor's, and the check goes to the desk.
 */
async function start({ memberId, kyc }: Subject): Promise<Response> {
  if (returnUrl === null) return reply({ error: 'not_configured' }, 503);
  const record = await currentRecord(memberId);
  const canStart = record?.status === 'started' || record?.status === 'needs_pan';
  if (!canStart || typeof record?.photo_path !== 'string') return reply({ error: 'The selfie comes first' }, 409);
  await rpc('begin_kyc_vendor_call', { p_member_id: memberId, p_is_paid: true }, null);
  const started = await kyc.startDigiLocker({ memberId, returnUrl, deliveryUrl });
  if (!started.ok) {
    await giveBackCall(memberId, started.error);
    const atTheDesk = await toTheDesk(memberId, 'start', { deskReason: 'not_started', failure: started.error });
    return atTheDesk ?? (await failureReply(memberId, 'start', started.error));
  }
  const { sessionId, deliveryKey } = started.value;
  await rpc('record_kyc_started', { p_member_id: memberId, p_session_id: sessionId, p_delivery_key: deliveryKey }, null);
  return reply({ redirectUrl: started.value.redirectUrl });
}

/**
 * No record from DigiLocker. An outage, or Zoop refusing RIVR's account rather than this session (decision 0674), is the
 * app's to ask again: the delivery may still come. A refusal of the session, nothing coming, or no keys: the check goes to
 * the desk, and leaving its session forgets what was delivered for it.
 */
async function notCompleted(memberId: string, failure: AdapterFailure): Promise<Response> {
  const isPassing = failure.code === 'unavailable' || failure.code === 'rate_limited' || (failure.code === 'rejected' && failure.cause !== undefined);
  if (isPassing) return await failureReply(memberId, 'complete', failure);
  return (await toTheDesk(memberId, 'complete', { deskReason: 'digilocker_failed', failure })) ?? reply({ status: 'started' });
}

/**
 * Why Zoop's answer does not verify the member, or null when it does: a face that is not the selfie's (the desk is warned,
 * with Zoop's score), or an Aadhaar with no full date of birth.
 */
function whyUnverified(face: FaceMatch, record: DigiLockerRecord): Unverified | null {
  if (!face.isMatch) {
    return { deskReason: 'face_unconfirmed', failure: { code: 'rejected', reason: 'Zoop face not matched' }, faceMatchScore: Math.round(face.score) };
  }
  return record.dateOfBirth === null ? { deskReason: 'no_date_of_birth', failure: { code: 'rejected', reason: 'Zoop no date of birth' } } : null;
}

/** DigiLocker's record kept with the face match's verdict; the status the check is left at. */
async function recordDigiLocker(memberId: string, record: DigiLockerRecord, face: FaceMatch): Promise<unknown> {
  const { name, dateOfBirth, maskedAadhaar, aadhaarReference, pan, address, vendorReference } = record;
  return await rpc('record_kyc_digilocker', {
    p_member_id: memberId, p_date_of_birth: dateOfBirth, p_masked_aadhaar: maskedAadhaar, p_aadhaar_reference: aadhaarReference,
    p_pan: pan, p_address: address, p_vendor_reference: vendorReference,
    p_face_matches: face.isMatch, p_face_match_score: Math.round(face.score),
    // Duplicates by the document's name, date of birth and last four digits (decision 0197); with no date of birth, none,
    // and the check waits for staff.
    p_identity_key: dateOfBirth === null ? null : kycIdentityKey(name, dateOfBirth, maskedAadhaar),
    // The Aadhaar's name becomes the member's once verified; the one they gave stays as what they are known as (#803).
    p_name: name,
  }, null);
}

/**
 * The member is back from DigiLocker: take the record and match its photo against the selfie. Until Zoop's delivery comes
 * the app is told to wait, and asks again. The member's face verifies them at once, whatever name they registered
 * (decision 0400). A face that is not theirs, an Aadhaar with no full date of birth, or no record at all: Zoop did not
 * verify them, and the desk does, in person (decision 0678).
 */
async function complete({ memberId, kyc }: Subject): Promise<Response> {
  const record = await currentRecord(memberId);
  const session = record?.digilocker_session_id;
  if (typeof session !== 'string' || typeof record?.photo_path !== 'string') return reply({ error: 'No DigiLocker hand-off to complete' }, 409);
  if (record.status !== 'started') return reply({ status: record.status });
  // Asking whether the record is in costs nothing; the face match is paid, and counts against the five a day.
  await rpc('begin_kyc_vendor_call', { p_member_id: memberId, p_is_paid: false }, null);
  const pulled = await digiLockerRecord(memberId, session, kyc);
  if (!pulled.ok) return await notCompleted(memberId, pulled.error);
  if (pulled.value === 'waiting') return reply({ status: 'waiting' });
  return await matchAndRecord(memberId, record.photo_path, kyc, pulled.value);
}

/** DigiLocker's record against the selfie, a paid call: kept when Zoop verifies the member, else the desk checks them. */
async function matchAndRecord(memberId: string, selfiePath: string, kyc: KycAdapter, delivered: DigiLockerRecord): Promise<Response> {
  await rpc('begin_kyc_vendor_call', { p_member_id: memberId, p_is_paid: true }, null);
  const face = await kyc.matchFace({ selfieUrl: await photoUrl(selfiePath), referenceUrl: delivered.photoUrl });
  if (!face.ok) {
    // Zoop refusing the match outright (it could not read it, or a code of its own) leaves the face unconfirmed: the desk
    // checks it, warned. An outage is asked again, the record still delivered.
    if (face.error.code !== 'rejected' || face.error.cause !== undefined) return await failed(memberId, 'complete', face.error);
    return (await toTheDesk(memberId, 'complete', { deskReason: 'face_unconfirmed', failure: face.error })) ?? reply({ status: 'started' });
  }
  const unverified = whyUnverified(face.value, delivered);
  if (unverified !== null) return (await toTheDesk(memberId, 'complete', unverified)) ?? reply({ status: 'started' });
  // Recorded, the check leaves its session, and what was delivered for it goes (decision 0676).
  return reply({ status: await recordDigiLocker(memberId, delivered, face.value) });
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
