// The selfie, the first step of KYC (#5). The vendor checks it is a live person; Cashfree has no search of
// the faces already enrolled, so none is made (decision 0197). A passing selfie is kept in the private kyc
// bucket as the member's KYC photo; anything else is deleted.
import { jpegFromBase64 } from './jpeg.ts';
import { currentRecord, failed, field, photoUrl, putPhoto, removePhoto, reply, rpc } from './server.ts';
import type { Kyc, Subject } from './subject.ts';

type FaceCheck =
  | { readonly ok: true; readonly score: number }
  | { readonly ok: false; readonly response: Response };

/** Liveness; a failure carries the reply to send. */
async function checkFace(kyc: Kyc, selfieUrl: string): Promise<FaceCheck> {
  const live = await kyc.checkLiveness({ selfieUrl });
  if (!live.ok) return { ok: false, response: failed(live.error) };
  if (!live.value.isLive) return { ok: false, response: reply({ error: 'not_live' }, 422) };
  return { ok: true, score: Math.round(live.value.score) };
}

/** Stores the selfie, checks it, and records it; whatever is not recorded is deleted again. */
async function checkAndKeep({ memberId, venueId, kyc }: Subject, jpeg: Uint8Array<ArrayBuffer>): Promise<Response> {
  const path = `${venueId}/${memberId}/selfie.jpg`;
  let isKept = false;
  try {
    await putPhoto(path, jpeg);
    const checked = await checkFace(kyc, await photoUrl(path));
    if (!checked.ok) return checked.response;
    const status = await rpc('record_kyc_selfie', {
      p_member_id: memberId, p_liveness_score: checked.score, p_same_face_as: null,
    }, null);
    isKept = status === 'started' || status === 'refused';
    return reply({ status });
  } finally {
    if (!isKept) {
      await removePhoto(path);
      await rpc('release_kyc_selfie', { p_member_id: memberId }, null);
    }
  }
}

/** Takes the member's one selfie, before DigiLocker. DigiLocker's photo is later matched against it. */
export async function takeSelfie(subject: Subject, token: string, body: unknown): Promise<Response> {
  const jpeg = jpegFromBase64(field(body, 'image'));
  if (jpeg === null) return reply({ error: 'image must be a JPEG of at most 2 MB, in base64' }, 400);
  const record = await currentRecord(subject.memberId);
  if (record !== null && (record.status !== 'started' || record.photo_path !== null)) return reply({ error: 'The selfie is already taken' }, 409);
  // DPDP: the member consents to the identity check before anything is sent to the vendor.
  await rpc('give_consent', { p_purpose: 'kyc_verification' }, token);
  await rpc('begin_kyc_vendor_call', { p_member_id: subject.memberId, p_is_paid: true }, null);
  // One selfie check at a time, so two uploads cannot race to be the KYC photo.
  if ((await rpc('claim_kyc_selfie', { p_member_id: subject.memberId }, null)) !== true) {
    return reply({ error: 'A selfie is already being checked' }, 409);
  }
  return await checkAndKeep(subject, jpeg);
}
