import { shrinkPhoto, toBase64, type KycDocumentKind } from '@rivr/db';
import { t } from '@rivr/i18n';

/** A photo the desk takes: the member's face, or one of their cards (decision 0573). */
export type DeskPhotoKind = 'face' | KycDocumentKind;

/** A photo as it is sent, and as staff see it. */
export interface DeskPhoto {
  jpeg: Blob;
  preview: string;
}

/** The photos of a check, in the order the desk takes them (decision 0573). */
export const PHOTO_KINDS: readonly DeskPhotoKind[] = ['face', 'pan', 'aadhaar_front'];

/** The check's five steps (redesign RD-21), in order: the member, their three photos, then the details. */
export const STEPS = ['member', 'face', 'pan', 'aadhaar_front', 'details'] as const;
export type Step = (typeof STEPS)[number];

/** Each step's name, as the check's progress bar says it. */
export const stepNames = () => STEPS.map((step) => t(`console.kycInPerson.steps.${step}`));

/**
 * The photo the camera took, ready to send and to show; null for one the browser cannot read. The face is made small, as
 * for the app's selfie; a card stays as the card camera made it, or its characters could not be read later.
 */
export async function readyPhoto(kind: DeskPhotoKind, taken: Blob): Promise<DeskPhoto | null> {
  const jpeg = kind === 'face' ? await shrinkPhoto(taken).catch(() => null) : taken;
  return jpeg === null ? null : { jpeg, preview: `data:image/jpeg;base64,${await toBase64(jpeg)}` };
}
