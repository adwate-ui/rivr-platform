import type { MemberId, Pan, Result } from '@rivr/contracts';
import type { AdapterFailure } from '../shared/failure.ts';

/** A DigiLocker consent hand-off: send the member to `redirectUrl`; they come back to the return URL. */
export interface DigiLockerSession {
  readonly sessionId: string;
  readonly redirectUrl: string;
}

/** What DigiLocker returns once the member consents. Only the masked Aadhaar ever leaves the vendor. */
export interface DigiLockerRecord {
  readonly name: string;
  /** ISO date, `1990-01-01`. */
  readonly dateOfBirth: string;
  /** `XXXX XXXX 1234`. */
  readonly maskedAadhaar: string;
  /**
   * The vendor's stable reference for the Aadhaar number (a token or hash, never the number): the
   * same on every pull for the same Aadhaar, so a second account with it is a duplicate. Null when the
   * vendor gives none, as Cashfree does: the database then matches name, date of birth and the last four
   * digits instead (decision 0197).
   */
  readonly aadhaarReference: string | null;
  /** Null when DigiLocker holds no PAN; verify one with `verifyPan` instead. */
  readonly pan: Pan | null;
  readonly address: string;
  /** A short-lived link to the Aadhaar photo, the reference for face match. */
  readonly photoUrl: string;
  readonly vendorReference: string;
}

/** Whether a PAN exists and matches the name given. */
export interface PanVerification {
  readonly isValid: boolean;
  readonly nameMatches: boolean;
  /** Whether the PAN's date of birth is the one given. */
  readonly dateOfBirthMatches: boolean;
  readonly vendorReference: string;
}

/** The vendor's liveness verdict on a selfie; `score` runs 0 to 100. */
export interface LivenessCheck {
  readonly isLive: boolean;
  readonly score: number;
  readonly vendorReference: string;
}

/** The vendor's verdict on whether two faces are the same person; `score` runs 0 to 100. */
export interface FaceMatch {
  readonly isMatch: boolean;
  readonly score: number;
  readonly vendorReference: string;
}

/**
 * KYC: DigiLocker pull of masked Aadhaar and PAN, PAN verification fallback, selfie liveness and face
 * match. No face search: Cashfree has none (decision 0197).
 */
export interface KycAdapter {
  /** Starts a DigiLocker consent hand-off for a member. */
  startDigiLocker(input: {
    readonly memberId: MemberId;
    readonly returnUrl: string;
  }): Promise<Result<DigiLockerSession, AdapterFailure>>;
  /** Pulls the consented record once the member is back. */
  pullDigiLocker(input: { readonly sessionId: string }): Promise<Result<DigiLockerRecord, AdapterFailure>>;
  /** Checks a PAN when DigiLocker has none. */
  verifyPan(input: {
    readonly pan: Pan;
    readonly name: string;
    readonly dateOfBirth: string;
  }): Promise<Result<PanVerification, AdapterFailure>>;
  /** Checks that a selfie is of a live person. */
  checkLiveness(input: { readonly selfieUrl: string }): Promise<Result<LivenessCheck, AdapterFailure>>;
  /** Compares the selfie with the DigiLocker photo. */
  matchFace(input: { readonly selfieUrl: string; readonly referenceUrl: string }): Promise<Result<FaceMatch, AdapterFailure>>;
}
