import type { Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import type { PanVerification } from './types.ts';

/** What re-checking a KYC check made in person found (#259): a match, or how the vendor's answer differed. */
export type PanRecheckOutcome = 'matched' | 'pan_invalid' | 'name_differs' | 'date_of_birth_differs';

/**
 * The vendor's PAN answer as a re-check's outcome, or null when the vendor gave none (an outage, a refused or
 * unconfigured call): the check is then asked again later, never sent to review for the vendor's own trouble.
 */
export function panRecheckOutcome(answer: Result<PanVerification, AdapterFailure>): PanRecheckOutcome | null {
  if (!answer.ok) return null;
  if (!answer.value.isValid) return 'pan_invalid';
  if (!answer.value.nameMatches) return 'name_differs';
  return answer.value.dateOfBirthMatches ? 'matched' : 'date_of_birth_differs';
}
