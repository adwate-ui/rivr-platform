import type { KycCheck, KycRefusal, KycReviewFailure, KycWaitReason } from '@rivr/db';
import { formatDate, formatTime, t, type MessageKey } from '@rivr/i18n';

const REFUSAL_COPY: Readonly<Record<KycRefusal, MessageKey>> = {
  under_18: 'console.kycReview.underEighteen',
  duplicate_face: 'console.kycReview.duplicateFace',
  duplicate_pan: 'console.kycReview.duplicatePan',
  duplicate_aadhaar: 'console.kycReview.duplicateAadhaar',
  staff_rejected: 'console.kycReview.staffRejected',
  on_break: 'console.kycReview.onBreak',
};

const WAIT_COPY: Readonly<Record<KycWaitReason, MessageKey>> = {
  pan_alone: 'console.kycReview.waitPanAlone',
  nothing_kept: 'console.kycReview.waitNothingKept',
  no_date_of_birth: 'console.kycReview.waitNoDateOfBirth',
  clash: 'console.kycReview.waitClash',
  recheck_pan_invalid: 'console.kycReview.waitRecheckPanInvalid',
  recheck_name_differs: 'console.kycReview.waitRecheckNameDiffers',
  recheck_date_of_birth_differs: 'console.kycReview.waitRecheckDateOfBirthDiffers',
};

const METHOD_COPY: Readonly<Record<KycCheck['method'], MessageKey>> = {
  digilocker: 'console.kycReview.digilocker',
  pan: 'console.kycReview.panAlone',
  manual: 'console.kycInPerson.method',
};

/** What the console says for each way a decision can fail. */
export const FAILURE_COPY: Readonly<Record<KycReviewFailure, MessageKey>> = {
  not_allowed: 'console.kycReviewFailures.notAllowed',
  decided: 'console.kycReviewFailures.decided',
  needs_date_of_birth: 'console.kycReviewFailures.needsDateOfBirth',
  needs_pan: 'console.kycReviewFailures.needsPan',
  invalid: 'console.kycReviewFailures.invalid',
  stopped: 'console.kycReviewFailures.stopped',
  paused: 'console.kycReviewFailures.paused',
  unavailable: 'console.kycReviewFailures.unavailable',
};

/** Where a check stands, in words: why it waits for review, why it was refused, or that it waits for a PAN. */
export function checkStatus(check: KycCheck): string | null {
  if (check.waitingBecause !== null) return t(WAIT_COPY[check.waitingBecause]);
  if (check.refusal !== null) return t(REFUSAL_COPY[check.refusal]);
  return check.status === 'needs_pan' ? t('console.kycReview.needsPan') : null;
}

/** When the check began to wait, for the queue's order of work. */
export function checkSince(check: KycCheck): string {
  const at = new Date(check.updatedAt);
  return t('console.kycReview.since', { date: formatDate(at), time: formatTime(at) });
}

/** An ISO day as noon UTC, so it formats as the same day in India. */
function day(iso: string): string {
  return formatDate(new Date(`${iso}T12:00:00Z`));
}

/** The date of birth to show: a missing one only while a reviewer must enter it from the original. */
function dateOfBirth(check: KycCheck): string | null {
  if (check.dateOfBirth !== null) return day(check.dateOfBirth);
  return check.status === 'needs_review' ? t('console.kycReview.notKept') : null;
}

/** How the check was made, with the vendor's scores when it has any. */
function method(check: KycCheck): { label: string; value: string } {
  if (check.livenessScore === null && check.faceMatchScore === null) {
    return { label: t('console.kycReview.method'), value: t(METHOD_COPY[check.method]) };
  }
  const score = (value: number | null) => (value === null ? t('console.kycReview.none') : String(value));
  return {
    label: t(METHOD_COPY[check.method]),
    value: t('console.kycReview.scores', { liveness: score(check.livenessScore), match: score(check.faceMatchScore) }),
  };
}

/** The details a reviewer checks against the documents, label and value, in order; one the check does not hold is left out (C-06). */
export function checkDetails(check: KycCheck): readonly { label: string; value: string }[] {
  const details = [
    { label: t('console.kycReview.dateOfBirth'), value: dateOfBirth(check) },
    { label: t('console.kycReview.aadhaar'), value: check.maskedAadhaar },
    { label: t('console.kycReview.pan'), value: check.pan },
    { label: t('console.kycReview.address'), value: check.address },
    method(check),
    { label: t('console.kycReview.vendorReference'), value: check.vendorReference },
  ];
  return details.flatMap(({ label, value }) => (value === null ? [] : [{ label, value }]));
}

/** A check's line in the queue (console v3): how it was made and when it began to wait, or what the member owes, or the day refused. */
export function queueLine(check: KycCheck): string {
  const at = new Date(check.updatedAt);
  if (check.status === 'needs_pan') return t('console.kycReview.needsPanLine', { time: formatTime(at) });
  if (check.status === 'refused') return formatDate(at);
  return t('console.kycReview.queueLine', { method: t(METHOD_COPY[check.method]), time: formatTime(at) });
}

/** The queue in its groups: checks a reviewer decides, checks waiting on the member, and refused ones (C-06). */
export function checkGroups(checks: readonly KycCheck[]) {
  return {
    toReview: checks.filter((check) => check.status === 'needs_review'),
    onMember: checks.filter((check) => check.status === 'needs_pan'),
    refused: checks.filter((check) => check.status === 'refused'),
  };
}

/** The queue as PickList groups (console v3): to review, waiting on the member and refused, each with its count; an empty one is left out. */
export function queueGroups(checks: readonly KycCheck[]) {
  const groups = checkGroups(checks);
  const group = (label: string, list: readonly KycCheck[]) => ({
    label, count: list.length, items: list.map((check) => ({ id: check.memberId, title: check.fullName, detail: queueLine(check) })),
  });
  return [
    group(t('console.kycReview.waiting'), groups.toReview),
    group(t('console.kycReview.onMember'), groups.onMember),
    group(t('console.kycReview.refused'), groups.refused),
  ];
}

/**
 * Whether a super admin may reopen this check: a refused one done in person (#267), refused as a duplicate; or, while the
 * club checks identity at the desk (decision 0502), one the app's vendor held, waiting for review or refused as a
 * duplicate, which moves to the desk.
 */
export function mayReopen(check: KycCheck, isSuperAdmin: boolean, isAtTheClub = false): boolean {
  // The database reopens only a duplicate PAN or Aadhaar refusal; under 18 or a reviewer's refusal stays (F1-13).
  const isDuplicate = check.status === 'refused' && (check.refusal === 'duplicate_pan' || check.refusal === 'duplicate_aadhaar');
  if (check.method === 'manual') return isSuperAdmin && isDuplicate;
  return isSuperAdmin && isAtTheClub && (isDuplicate || check.status === 'needs_review');
}
