// The optional photo a member gives at sign-up (#631), kept beside their identity images as <venue>/<member>/photo.jpg,
// once. As the selfie, it is a JPEG without its metadata, written with the service role, as no client may write the
// bucket; the database, asked as the member, says whether they may still add one (begin_sign_up_photo: a member, not
// frozen, sign-up open, none kept yet). Nothing is sent to the KYC vendor.
import { jpegFromBase64 } from './jpeg.ts';
import { field, putPhoto, reply, rpc } from './server.ts';
import type { Subject } from './subject.ts';

/** Stores the member's sign-up photo, unless they have one: either way it is kept. */
export async function takeSignUpPhoto({ memberId, venueId }: Subject, token: string, body: unknown): Promise<Response> {
  const jpeg = jpegFromBase64(field(body, 'image'));
  if (jpeg === null) return reply({ error: 'image must be a JPEG of at most 2 MB, in base64' }, 400);
  if ((await rpc('begin_sign_up_photo', {}, token)) === true) await putPhoto(`${venueId}/${memberId}/photo.jpg`, jpeg);
  return reply({ status: 'kept' });
}
