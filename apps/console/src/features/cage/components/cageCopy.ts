import type { CageFailure, CageMember, KycRefusal, PayoutAccountFailure } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';

/** Why chips were not issued, for the cashier. */
export const CAGE_FAILURE_COPY: Readonly<Record<CageFailure, MessageKey>> = {
  not_allowed: 'console.cage.notAllowed',
  no_member: 'console.cage.noMember',
  stopped: 'console.cage.stopped',
  paused: 'console.cage.paused',
  kyc_needed: 'console.cage.kycBlock',
  under_age: 'console.cage.underAgeBlock',
  duplicate: 'console.cage.duplicateBlock',
  on_break: 'console.cage.onBreak',
  not_seated: 'console.cage.notSeatedBlock',
  not_chips: 'console.cage.notChips',
  below_minimum: 'console.cage.belowMinimum',
  wallet_short: 'console.cage.walletShort',
  bonus_short: 'console.cage.bonusShort',
  utr_used: 'console.cage.utrUsed',
  moved: 'console.cage.moved',
  not_in_room: 'console.cage.notInRoom',
  call_time_owed: 'console.cage.callTimeOwedBlock',
  invalid: 'console.cage.invalid',
  unavailable: 'console.cage.unavailable',
};

/** Why a decision on a payout account was refused, for the cashier. */
export const PAYOUT_FAILURE_COPY: Readonly<Record<PayoutAccountFailure, MessageKey>> = {
  too_many: 'console.cage.payoutTooMany',
  already_added: 'console.cage.payoutAlreadyAdded',
  invalid: 'console.cage.payoutInvalid',
  not_allowed: 'console.cage.payoutNotAllowed',
  stopped: 'console.cage.payoutStopped',
  paused: 'console.cage.payoutPaused',
  unavailable: 'console.cage.payoutUnavailable',
};

/** Why a member's identity check failed, in the KYC review's words (#58). */
const KYC_REFUSAL_COPY: Readonly<Record<KycRefusal, MessageKey>> = {
  under_18: 'console.kycReview.underEighteen',
  duplicate_pan: 'console.kycReview.duplicatePan',
  duplicate_aadhaar: 'console.kycReview.duplicateAadhaar',
  duplicate_face: 'console.kycReview.duplicateFace',
  staff_rejected: 'console.kycReview.staffRejected',
};

/** What the cage says of a member whose identity check is not complete: the reason it failed, or that it is not finished. */
export function kycBlockOf(member: CageMember): string {
  return t(member.kycRefusal === null ? 'console.cage.kycBlock' : KYC_REFUSAL_COPY[member.kycRefusal]);
}