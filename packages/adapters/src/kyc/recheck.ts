import type { Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';
import type { PanVerification } from './types.ts';

/** What re-checking a KYC check made in person found (#259): a match, or how the vendor's answer differed. */
export type PanRecheckOutcome = 'matched' | 'pan_invalid' | 'name_differs' | 'date_of_birth_differs';

/**
 * The vendor's PAN answer as a re-check's outcome, or null when the vendor gave none (an outage, a refused or
 * unconfigured call): never sent to review for the vendor's own trouble. `panRecheckFailure` says what to do then.
 */
export function panRecheckOutcome(answer: Result<PanVerification, AdapterFailure>): PanRecheckOutcome | null {
  if (!answer.ok) return null;
  if (!answer.value.isValid) return 'pan_invalid';
  if (!answer.value.nameMatches) return 'name_differs';
  return answer.value.dateOfBirthMatches ? 'matched' : 'date_of_birth_differs';
}

/**
 * What a re-check does when its PAN call failed (decision 0674): ask again `later` (an outage, even one after a paid
 * call), `pause` every re-check (the vendor refused RIVR's account, which every check would get), or count it `refused`
 * (the vendor turned down this check's request; the third ends its re-check).
 */
export type PanRecheckFailure = 'later' | 'pause' | 'refused';

export function panRecheckFailure(failure: AdapterFailure): PanRecheckFailure {
  if (failure.code !== 'rejected') return 'later';
  if (failure.cause === 'account') return 'pause';
  return failure.cause === undefined ? 'refused' : 'later';
}
