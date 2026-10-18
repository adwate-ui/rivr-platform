import type { KycCheck, KycRefusal, KycReviewFailure } from '@rivr/db';
import { formatDate, t, type MessageKey } from '@rivr/i18n';

const REFUSAL_COPY: Readonly<Record<KycRefusal, MessageKey>> = {
  under_18: 'console.kycReview.underEighteen',
  duplicate_face: 'console.kycReview.duplicateFace',
  duplicate_pan: 'console.kycReview.duplicatePan',
  duplicate_aadhaar: 'console.kycReview.duplicateAadhaar',
  staff_rejected: 'console.kycReview.staffRejected',
};

/** What the console says for each way a decision can fail. */
export const FAILURE_COPY: Readonly<Record<KycReviewFailure, MessageKey>> = {
  not_allowed: 'console.kycReviewFailures.notAllowed',
  decided: 'console.kycReviewFailures.decided',
  needs_date_of_birth: 'console.kycReviewFailures.needsDateOfBirth',
  invalid: 'console.kycReviewFailures.invalid',
  stopped: 'console.kycReviewFailures.stopped',
  unavailable: 'console.kycReviewFailures.unavailable',
};

/** Where a check stands, for one that is not waiting for review: refused, and why, or waiting for a PAN. */
export function checkStatus(check: KycCheck): string | null {
  if (check.refusal !== null) return t(REFUSAL_COPY[check.refusal]);
  return check.status === 'needs_pan' ? t('console.kycReview.needsPan') : null;
}

/** An ISO day as noon UTC, so it formats as the same day in India. */
function day(iso: string): string {
  return formatDate(new Date(`${iso}T12:00:00Z`));
}

/** The details a reviewer checks against the documents, label and value, in order. */
export function checkDetails(check: KycCheck): readonly { label: string; value: string }[] {
  const none = t('console.kycReview.none');
  const score = (value: number | null) => (value === null ? none : String(value));
  return [
    { label: t('console.kycReview.dateOfBirth'), value: check.dateOfBirth === null ? t('console.kycReview.notKept') : day(check.dateOfBirth) },
    { label: t('console.kycReview.aadhaar'), value: check.maskedAadhaar ?? none },
    { label: t('console.kycReview.pan'), value: check.pan ?? none },
    { label: t('console.kycReview.address'), value: check.address ?? none },
    {
      label: t(check.method === 'pan' ? 'console.kycReview.panAlone' : 'console.kycReview.digilocker'),
      value: t('console.kycReview.scores', { liveness: score(check.livenessScore), match: score(check.faceMatchScore) }),
    },
  ];
}
