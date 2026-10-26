import type { KycInPerson } from '@rivr/contracts';
import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toBase64 } from './kyc.ts';
import { functionErrorCode } from './parse/kycFailure.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** Why a check was refused: the gate's reasons, or a reviewer's rejection. */
export type KycRefusal = 'under_18' | 'duplicate_face' | 'duplicate_pan' | 'duplicate_aadhaar' | 'staff_rejected' | 'on_break';

/**
 * An identity check as a KYC reviewer sees it: what the vendor found (scores 0 to 100), the KYC photo's
 * path for `useKycImageUrl`, and the members whose checks hold the same PAN, Aadhaar or face.
 */
export interface KycCheck {
  readonly memberId: string;
  readonly fullName: string;
  /** `needs_review` waits for a reviewer; `needs_pan` waits for the member; `refused` is final. */
  readonly status: 'needs_review' | 'needs_pan' | 'refused';
  /** `manual`: checked in person by a KYC reviewer at the club, while no vendor is live (#246). */
  readonly method: 'digilocker' | 'pan' | 'manual';
  /** Why a check waits for review: a PAN alone, nothing kept, no date of birth, or a clash; null otherwise. */
  readonly waitingBecause: KycWaitReason | null;
  /** Null when the vendor's was not kept: the reviewer enters the one on the original document. */
  readonly dateOfBirth: string | null;
  readonly maskedAadhaar: string | null;
  readonly pan: string | null;
  readonly address: string | null;
  readonly photoPath: string | null;
  readonly livenessScore: number | null;
  readonly faceMatchScore: number | null;
  /** The vendor's own reference, to look the check up with them. */
  readonly vendorReference: string | null;
  readonly refusal: KycRefusal | null;
  readonly clashesWith: readonly string[];
  /** When the check last moved: for one waiting, when it began to wait. */
  readonly updatedAt: string;
}

/** Why a check waits for a reviewer. */
export type KycWaitReason = 'pan_alone' | 'nothing_kept' | 'no_date_of_birth' | 'clash';

/** Why a review did not go through, as the console tells it. */
export type KycReviewFailure =
  | 'not_allowed' | 'decided' | 'needs_date_of_birth' | 'needs_pan' | 'invalid' | 'stopped' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, KycReviewFailure>> = {
  '42501': 'not_allowed', RVKYC: 'decided', RVDOB: 'needs_date_of_birth', RVPAN: 'needs_pan', '22023': 'invalid',
  RVFRZ: 'stopped', RVMBR: 'stopped', RVKIL: 'paused',
};

const STATUSES = ['needs_review', 'needs_pan', 'refused'] as const;
const METHODS = ['digilocker', 'pan', 'manual'] as const;
const WAIT_REASONS = ['pan_alone', 'nothing_kept', 'no_date_of_birth', 'clash'] as const;
const REFUSALS = ['under_18', 'duplicate_face', 'duplicate_pan', 'duplicate_aadhaar', 'staff_rejected', 'on_break'] as const;

/** One of `known`, or a fault: a value this console does not know is never shown as some other. */
function oneOf<Value extends string>(known: readonly Value[], value: string): Value {
  const found = known.find((candidate) => candidate === value);
  if (found === undefined) throw new Error(`Unknown KYC value: ${value}`);
  return found;
}

/** The venue's checks for a KYC reviewer: those waiting for review first, then the stopped and the refused. */
export function useKycReviewQueue(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.kycReview(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<KycCheck[]> => {
      const { data, error } = await client.rpc('kyc_review_queue', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        memberId: row.member_id, fullName: row.full_name, status: oneOf(STATUSES, row.status), method: oneOf(METHODS, row.method),
        waitingBecause: row.waiting_because === null ? null : oneOf(WAIT_REASONS, row.waiting_because),
        dateOfBirth: row.date_of_birth, maskedAadhaar: row.masked_aadhaar, pan: row.pan, address: row.address, photoPath: row.photo_path,
        livenessScore: row.liveness_score, faceMatchScore: row.face_match_score, vendorReference: row.vendor_reference,
        refusal: row.refusal === null ? null : oneOf(REFUSALS, row.refusal), clashesWith: row.clashes_with, updatedAt: row.updated_at,
      }));
    },
  });
}

/** A reviewer's decision: approve or reject with the reason, and the date of birth and PAN where the check has none. */
export interface KycDecision {
  memberId: string;
  approve: boolean;
  reason: string;
  dateOfBirth?: string | undefined;
  pan?: string | undefined;
}

/**
 * Deciding a check waiting for review (`review_kyc`). Resolves to where the check ended, `verified` or
 * `refused` (the gate refuses under 18 and a duplicate of a verified member whatever the reviewer
 * decides), or why it did not go through; then reloads the queue.
 */
export function useKycReviewActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const review = useMutation({
    mutationFn: async (decision: KycDecision): Promise<Result<'verified' | 'refused', KycReviewFailure>> => {
      const { data, error } = await client.rpc('review_kyc', {
        p_member_id: decision.memberId, p_approve: decision.approve, p_reason: decision.reason,
        ...(decision.dateOfBirth === undefined ? {} : { p_date_of_birth: decision.dateOfBirth }),
        ...(decision.pan === undefined ? {} : { p_pan: decision.pan }),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.kycReview(userId ?? 'signed-out', venueId) });
      if (error) return err(FAILURE_BY_CODE[error.code] ?? 'unavailable');
      return ok(data === 'verified' ? 'verified' : 'refused');
    },
  });
  // A super admin reopens a refused check done in person, with the reason (#267), so the member can
  // be checked in person again.
  const reopen = useMutation({
    mutationFn: async ({ memberId, reason }: { memberId: string; reason: string }): Promise<Result<'reopened', KycReviewFailure>> => {
      const { error } = await client.rpc('reopen_kyc_check', { p_member_id: memberId, p_reason: reason });
      const user = userId ?? 'signed-out';
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.kycReview(user, venueId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.kycInPersonSearches(user, venueId) }),
      ]);
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok('reopened');
    },
  });
  return { review, reopen };
}

/** A member a KYC reviewer may check in person: no check yet (`status` null), or one the app started and never finished. */
export interface KycCandidate {
  readonly memberId: string;
  readonly fullName: string;
  /** The last four digits of their mobile number, to tell two of the same name apart. */
  readonly phoneLast4: string;
  readonly status: 'started' | null;
}

const CANDIDATE_STATUSES = ['started'] as const;

/** The members found by name, or by the last digits of their number, for a check in person (two characters at least). */
export function useKycInPersonCandidates(venueId: string, search: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.kycInPersonCandidates(userId ?? 'signed-out', venueId, search.trim()),
    enabled: userId !== null && search.trim().length >= 2,
    queryFn: async (): Promise<KycCandidate[]> => {
      const { data, error } = await client.rpc('kyc_in_person_candidates', { p_venue_id: venueId, p_search: search.trim() });
      if (error) throw error;
      return data.map((row) => ({
        memberId: row.member_id, fullName: row.full_name, phoneLast4: row.phone_last4,
        status: row.status === null ? null : oneOf(CANDIDATE_STATUSES, row.status),
      }));
    },
  });
}

/** Why a check in person did not go through, as the console tells it. */
export type KycInPersonFailure = 'not_allowed' | 'decided' | 'no_photo' | 'invalid' | 'stopped' | 'unavailable';

const IN_PERSON_FAILURES: readonly KycInPersonFailure[] = ['not_allowed', 'decided', 'no_photo', 'invalid', 'stopped'];

/** Where a check in person ended. */
export type KycInPersonOutcome = 'verified' | 'refused' | 'needs_review';

const IN_PERSON_OUTCOMES: readonly KycInPersonOutcome[] = ['verified', 'needs_review'];

/**
 * A check in person (the kyc-in-person Edge Function): the member's photo (a JPEG) and the details
 * from their originals. Resolves to where the check ended: `verified`, `refused` (the gate refuses
 * under 18 and a PAN or Aadhaar a verified member holds) or `needs_review` (another check holds the
 * same PAN, Aadhaar or face); or why it did not go through. Then reloads the queue.
 */
export function useKycInPerson(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const check = useMutation({
    mutationFn: async ({ photo, ...details }: KycInPerson & { photo: Blob }): Promise<Result<KycInPersonOutcome, KycInPersonFailure>> => {
      const { data, error } = await client.functions.invoke('kyc-in-person', { body: { ...details, image: await toBase64(photo) } });
      const user = userId ?? 'signed-out';
      // The queue, which now holds a refused check, and the search, which no longer finds a decided one.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.kycReview(user, venueId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.kycInPersonSearches(user, venueId) }),
      ]);
      if (error) {
        const code = await functionErrorCode(error);
        return err(IN_PERSON_FAILURES.find((known) => known === code) ?? 'unavailable');
      }
      const status: unknown = typeof data === 'object' && data !== null ? Reflect.get(data, 'status') : null;
      // Anything else reads as refused, the safe reading.
      return ok(IN_PERSON_OUTCOMES.find((known) => known === status) ?? 'refused');
    },
  });
  return { check };
}
