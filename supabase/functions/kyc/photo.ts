// The optional photo a member gives at sign-up (#631), kept beside their identity images as <venue>/<member>/photo.jpg,
// once. As the selfie, it is a JPEG without its metadata, written with the service role, as no client may write the
// bucket; the database, asked as the member, says whether they may still add one (begin_sign_up_photo: a member, not
// frozen, sign-up open, none kept yet). Nothing is sent to the KYC vendor. While the venue checks identity at the club
// (decision 0502), it is the selfie that lets the member in: their check is then marked to wait for the desk.
import { jpegFromBase64 } from './jpeg.ts';
import { field, putPhoto, reply, rpc } from './server.ts';
import type { Subject } from './subject.ts';

/** Stores the member's sign-up photo, unless they have one: either way it is kept. `at_club` once it lets them in. */
export async function takeSignUpPhoto({ memberId, venueId }: Subject, token: string, body: unknown): Promise<Response> {
  const jpeg = jpegFromBase64(field(body, 'image'));
  if (jpeg === null) return reply({ error: 'image must be a JPEG of at most 2 MB, in base64' }, 400);
  if ((await rpc('begin_sign_up_photo', {}, token)) === true) await putPhoto(`${venueId}/${memberId}/photo.jpg`, jpeg);
  const isAtTheClub = (await rpc('take_kyc_at_the_club', {}, token)) === true;
  return reply({ status: isAtTheClub ? 'at_club' : 'kept' });
}
