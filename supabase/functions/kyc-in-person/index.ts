// KYC in person at the club (#246, the owner's answer to #235). While no KYC vendor is live, a KYC
// reviewer checks a member's original documents with the member there and takes their photo. The
// reviewer's own token asks the database first (authorize_in_person_kyc: the permission, never their
// own check, the KYC sign-up kill switch), which names a path for this check's photo alone; only then
// is the photo stored, with the service role; then the check is settled as the reviewer
// (check_kyc_in_person), through the same gate as every check. No vendor is called, so the practice
// venue reaches nothing outside either. Beside the face photo come the PAN and the Aadhaar front (decision 0573), and a
// body with a `kind` is one of those two taken again after a super admin sent it back.
import { kycDocumentRetakeSchema, kycInPersonSchema } from '@rivr/contracts';
import { jpegFromBase64 } from '../kyc/jpeg.ts';
import { CORS, currentRecord, field, putPhoto, refusal, removePhoto, removeUnnamedDocuments, reply, rpc } from '../kyc/server.ts';

// A check's three photos of at most 2 MB each, in base64, and the rest of the body.
const MAX_BODY_BYTES = 9 * 1024 * 1024;

/** A check's three photos, each a whole JPEG of at most 2 MB without its metadata; null if any is not. */
function photosOf(body: unknown) {
  const face = jpegFromBase64(field(body, 'image'));
  const panCard = jpegFromBase64(field(body, 'panImage'));
  const aadhaarFront = jpegFromBase64(field(body, 'aadhaarImage'));
  return face === null || panCard === null || aadhaarFront === null ? null : { face, panCard, aadhaarFront };
}

/** The member's folder of the kyc bucket, from a path in it. */
const folderOf = (path: string) => path.slice(0, path.lastIndexOf('/') + 1);

/** The check, as the reviewer: allowed first, then the photos stored, then the gate settles it. */
async function checkInPerson(token: string, body: unknown): Promise<Response> {
  const input = kycInPersonSchema.safeParse(body);
  if (!input.success) return reply({ error: 'invalid' }, 400);
  const { memberId, dateOfBirth, aadhaarLast4, pan, consent, coversConfirmed } = input.data;
  const path = await rpc('authorize_in_person_kyc', { p_member_id: memberId }, token);
  if (typeof path !== 'string') return reply({ error: 'unavailable' }, 502);
  // Decoded only for a caller who may: it is the bulk of the work.
  const photos = photosOf(body);
  if (photos === null) return reply({ error: 'invalid' }, 400);
  // Named for the face photo's path, so the three files of a check are found together (decision 0573).
  const panPath = path.replace('/in-person-', '/doc-pan-');
  const aadhaarPath = path.replace('/in-person-', '/doc-aadhaar-');
  try {
    // One at a time, so a failure leaves no upload on its way for the clearing below to miss.
    await putPhoto(path, photos.face);
    await putPhoto(panPath, photos.panCard);
    await putPhoto(aadhaarPath, photos.aadhaarFront);
    const status = await rpc('check_kyc_in_person', {
      p_member_id: memberId, p_photo_path: path, p_date_of_birth: dateOfBirth, p_aadhaar_last4: aadhaarLast4, p_pan: pan,
      p_consent: consent, p_pan_photo_path: panPath, p_aadhaar_photo_path: aadhaarPath, p_covers_confirmed: coversConfirmed,
    }, token);
    return reply({ status });
  } catch (error) {
    // The photo is this check's alone: remove it unless the record was committed before the failure and names it
    // (#595). If the record cannot be read, keep it: a stray file is better than a record whose photo is gone.
    const record = await currentRecord(memberId).catch(() => undefined);
    if (record !== undefined && record?.photo_path !== path) await removePhoto(path);
    throw error;
  } finally {
    await removeUnnamedDocuments(memberId, folderOf(path));
  }
}

/** A photo a super admin sent back, taken again: allowed first, then stored and put on file, then the old file cleared. */
async function retakeDocument(token: string, body: unknown): Promise<Response> {
  const input = kycDocumentRetakeSchema.safeParse(body);
  if (!input.success) return reply({ error: 'invalid' }, 400);
  const { memberId, kind, coversConfirmed } = input.data;
  const path = await rpc('authorize_kyc_document_retake', { p_member_id: memberId, p_kind: kind }, token);
  if (typeof path !== 'string') return reply({ error: 'unavailable' }, 502);
  const jpeg = jpegFromBase64(field(body, 'image'));
  if (jpeg === null) return reply({ error: 'invalid' }, 400);
  try {
    await putPhoto(path, jpeg);
    await rpc('record_kyc_document_retake', { p_member_id: memberId, p_kind: kind, p_path: path, p_covers_confirmed: coversConfirmed }, token);
    return reply({ status: 'retaken' });
  } finally {
    // Whichever way it went, this leaves only the file the row names: the new one, or the old one if this one failed.
    await removeUnnamedDocuments(memberId, folderOf(path));
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'POST') return reply({ error: 'POST only' }, 405);
  // A body without its length, or a longer one, is refused before it is read.
  const length = request.headers.get('content-length');
  if (length === null || length === '' || !(Number(length) <= MAX_BODY_BYTES)) return reply({ error: 'Too large' }, 413);
  const token = request.headers.get('authorization') ?? '';
  if (token === '') return reply({ error: 'not_allowed' }, 403);
  const body: unknown = await request.json().catch(() => null);
  try {
    return await (field(body, 'kind') === null ? checkInPerson(token, body) : retakeDocument(token, body));
  } catch (error) {
    return refusal(error);
  }
});
