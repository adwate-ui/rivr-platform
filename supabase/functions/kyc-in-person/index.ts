// KYC in person at the club (#246, the owner's answer to #235). While no KYC vendor is live, a KYC
// reviewer checks a member's original documents with the member there and takes their photo. The
// reviewer's own token asks the database first (authorize_in_person_kyc: the permission, never their
// own check, the KYC sign-up kill switch); only then is the photo stored, with the service role, as the
// member's KYC photo; then the check is settled as the reviewer (check_kyc_in_person), through the same
// gate as every check. No vendor is called, so the practice venue reaches nothing outside either.
import { kycInPersonSchema } from '@rivr/contracts';
import { jpegFromBase64 } from '../kyc/jpeg.ts';
import { CORS, field, putPhoto, refusal, removePhoto, reply, rpc } from '../kyc/server.ts';

// A photo of at most 2 MB, in base64, and the rest of the body.
const MAX_BODY_BYTES = 3 * 1024 * 1024;

/** Where the member's photo goes, and whether a started check already had one, as the database says. */
function placeFrom(rows: unknown): { path: string; hadPhoto: boolean } | null {
  const row: unknown = Array.isArray(rows) ? rows[0] : null;
  const path: unknown = typeof row === 'object' && row !== null ? Reflect.get(row, 'photo_path') : null;
  if (typeof path !== 'string' || typeof row !== 'object' || row === null) return null;
  return { path, hadPhoto: Reflect.get(row, 'has_photo') === true };
}

/** The check, as the reviewer: allowed first, then the photo stored, then the gate settles it. */
async function checkInPerson(token: string, body: unknown): Promise<Response> {
  const input = kycInPersonSchema.safeParse(body);
  const jpeg = jpegFromBase64(field(body, 'image'));
  if (!input.success || jpeg === null) return reply({ error: 'invalid' }, 400);
  const { memberId, dateOfBirth, aadhaarLast4, pan, consent } = input.data;
  const place = placeFrom(await rpc('authorize_in_person_kyc', { p_member_id: memberId }, token));
  if (place === null) return reply({ error: 'unavailable' }, 502);
  await putPhoto(place.path, jpeg);
  try {
    const status = await rpc('check_kyc_in_person', {
      p_member_id: memberId, p_date_of_birth: dateOfBirth, p_aadhaar_last4: aadhaarLast4, p_pan: pan, p_consent: consent,
    }, token);
    return reply({ status });
  } catch (error) {
    // A photo no check holds is not kept.
    if (!place.hadPhoto) await removePhoto(place.path);
    throw error;
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
    return await checkInPerson(token, body);
  } catch (error) {
    return refusal(error);
  }
});
