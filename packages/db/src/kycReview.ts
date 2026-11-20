import { KYC_DOCUMENT_KINDS, type KycDocumentKind, type KycInPerson } from '@rivr/contracts';
import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toBase64 } from './kyc.ts';
import { functionErrorCode } from './parse/kycFailure.ts';
import { useListPage, type ListView } from './lists.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';
import { LIST_MOST } from './limits.ts';

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
export type KycWaitReason =
  | 'pan_alone' | 'nothing_kept' | 'no_date_of_birth' | 'clash'
  // A check made in person that the vendor's re-check did not match (#259).
  | 'recheck_pan_invalid' | 'recheck_name_differs' | 'recheck_date_of_birth_differs';

/** Why a review did not go through, as the console tells it. */
export type KycReviewFailure =
  | 'not_allowed' | 'decided' | 'needs_date_of_birth' | 'needs_pan' | 'invalid' | 'stopped' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, KycReviewFailure>> = {
  '42501': 'not_allowed', RVKYC: 'decided', RVDOB: 'needs_date_of_birth', RVPAN: 'needs_pan', '22023': 'invalid',
  RVFRZ: 'stopped', RVMBR: 'stopped', RVKIL: 'paused',
};

const STATUSES = ['needs_review', 'needs_pan', 'refused'] as const;
const METHODS = ['digilocker', 'pan', 'manual'] as const;
const WAIT_REASONS = [
  'pan_alone', 'nothing_kept', 'no_date_of_birth', 'clash', 'recheck_pan_invalid', 'recheck_name_differs', 'recheck_date_of_birth_differs',
] as const;
const REFUSALS = ['under_18', 'duplicate_face', 'duplicate_pan', 'duplicate_aadhaar', 'staff_rejected', 'on_break'] as const;

/** One of `known`, or a fault: a value this console does not know is never shown as some other. */
export function oneOf<Value extends string>(known: readonly Value[], value: string): Value {
  const found = known.find((candidate) => candidate === value);
  if (found === undefined) throw new Error(`Unknown KYC value: ${value}`);
  return found;
}

/**
 * One page of the venue's checks for a KYC reviewer (redesign RD-30): those waiting for review first, then the stopped and
 * the refused, searched by name and paged on the server (`kyc_review_page`), with how many there are in all.
 */
export function useKycReviewPage(venueId: string, view: ListView | null) {
  const { client } = useRivrData();
  return useListPage({
    list: 'kyc_review', venueId, view,
    read: (asked) => client.rpc('kyc_review_page', { p_venue_id: venueId, p_view: asked }),
    rowOf: (row): KycCheck => ({
        memberId: row.member_id, fullName: row.full_name, status: oneOf(STATUSES, row.status), method: oneOf(METHODS, row.method),
        waitingBecause: row.waiting_because === null ? null : oneOf(WAIT_REASONS, row.waiting_because),
        dateOfBirth: row.date_of_birth, maskedAadhaar: row.masked_aadhaar, pan: row.pan, address: row.address, photoPath: row.photo_path,
        livenessScore: row.liveness_score, faceMatchScore: row.face_match_score, vendorReference: row.vendor_reference,
        refusal: row.refusal === null ? null : oneOf(REFUSALS, row.refusal), clashesWith: row.clashes_with, updatedAt: row.updated_at,
    }),
  });
}

/**
 * Whether the venue checks identity at the club now (decision 0502), for its KYC reviewers: a super admin may then reopen a
 * check the vendor held, to be checked at the desk. False for anyone else.
 */
export function useVenueKycAtTheClub(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.venueKycAtTheClub(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await client.rpc('kyc_at_the_club', { p_venue_id: venueId });
      if (error) throw error;
      return data === true;
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
      // A verified desk check's three files go from Storage at once (#931). One that cannot be removed now stays listed, until a
      // super admin's next ask or the member's next desk check.
      if (!error) await client.functions.invoke('kyc-reopened-files', { body: { memberId } }).catch(() => undefined);
      const user = userId ?? 'signed-out';
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.kycReview(user, venueId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.kycInPersonSearches(user, venueId) }),
        // A verified check reopened from the member's record (decision 0583): its documents go, and the record says so.
        queryClient.invalidateQueries({ queryKey: queryKeys.memberKycDocuments(user, venueId, memberId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.memberRecord(user, venueId, memberId) }),
      ]);
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok('reopened');
    },
  });
  return { review, reopen };
}

/** The verified member whose documents a duplicate clashed with. */
export interface KycDuplicateHolder {
  memberNumber: number;
  fullName: string;
}

/**
 * Who holds the documents a check refused as a duplicate clashed with (decision 0583), so the desk sees a check saved on the
 * wrong member; null for any other check, and for anyone who does not check members.
 */
export function useKycDuplicateHolder(memberId: string | null) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.kycDuplicateHolder(userId ?? 'signed-out', memberId ?? ''),
    enabled: userId !== null && memberId !== null,
    queryFn: async (): Promise<KycDuplicateHolder | null> => {
      const { data, error } = await client.rpc('kyc_duplicate_holder', { p_member_id: memberId ?? '' }).limit(LIST_MOST);
      if (error) throw error;
      const [row] = data;
      return row === undefined ? null : { memberNumber: row.member_number, fullName: row.full_name };
    },
  });
}

const CANDIDATE_STATUSES = ['started', 'needs_pan', 'verified', 'needs_review', 'refused'] as const;

/** A member a KYC reviewer may check in person: no check yet (`status` null), or one the app started and never finished. */
export interface KycCandidate {
  readonly memberId: string;
  readonly fullName: string;
  /** The last four digits of their mobile number, to tell two of the same name apart. */
  readonly phoneLast4: string;
  /** `verified`, `needs_review` or `refused` only for a member owed a photo a super admin sent back (`retakes`). */
  readonly status: (typeof CANDIDATE_STATUSES)[number] | null;
  /**
   * The selfie they took in the app to be checked at the club (decision 0502), for `useKycImageUrl`: their sign-up photo,
   * or the app's KYC selfie for a check reopened from the vendor. Staff compare it with the face at the desk. Null for
   * anyone else.
   */
  readonly clubSelfiePath: string | null;
  /** The document photos a super admin sent back, to be taken again (decision 0573). */
  readonly retakes: readonly KycRetake[];
  /**
   * Why the check waits for the desk when the app's check (Zoop) did not verify the member (decision 0678); null for a check
   * the club meant for the desk. `face_unconfirmed`: the face was not matched to the Aadhaar photo, and the desk is warned.
   */
  readonly deskReason: KycDeskReason | null;
}

const DESK_REASONS = ['face_unconfirmed', 'no_date_of_birth', 'digilocker_failed', 'not_started'] as const;

/** Why a check the app did not verify waits for the desk. */
export type KycDeskReason = (typeof DESK_REASONS)[number];

/** A document photo a super admin sent back, and why, in their words. */
export interface KycRetake {
  readonly kind: KycDocumentKind;
  readonly reason: string;
}

// The desk's lists ask again every 10 seconds: two or three staff check members at once, and a member checked or started
// on another device must show so before anyone else starts them (the owner, 20 Nov).
export const DESK_LIST_CHECK = 10_000;

interface CandidateRow {
  member_id: string;
  full_name: string;
  phone_last4: string;
  status: string | null;
  app_selfie_path: string | null;
  retake_kinds: string[];
  retake_reasons: string[];
  desk_reason: string | null;
}

const candidateOf = (row: CandidateRow): KycCandidate => ({
  memberId: row.member_id, fullName: row.full_name, phoneLast4: row.phone_last4,
  status: row.status === null ? null : oneOf(CANDIDATE_STATUSES, row.status),
  clubSelfiePath: row.app_selfie_path,
  retakes: row.retake_kinds.map((kind, at) => ({ kind: oneOf(KYC_DOCUMENT_KINDS, kind), reason: row.retake_reasons[at] ?? '' })),
  deskReason: typeof row.desk_reason === 'string' ? oneOf(DESK_REASONS, row.desk_reason) : null,
});

/** The members found by name, or by the last digits of their number, for a check in person (two characters at least). */
export function useKycInPersonCandidates(venueId: string, search: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.kycInPersonCandidates(userId ?? 'signed-out', venueId, search.trim()),
    enabled: userId !== null && search.trim().length >= 2,
    refetchInterval: DESK_LIST_CHECK,
    queryFn: async (): Promise<KycCandidate[]> => {
      const { data, error } = await client.rpc('kyc_in_person_candidates', { p_venue_id: venueId, p_search: search.trim() }).limit(LIST_MOST);
      if (error) throw error;
      return data.map(candidateOf);
    },
  });
}

/**
 * Who the desk should check tonight (audit F-091): members in the room or on a list whose check is not done, the longest
 * waiting first, as the same rows the search gives.
 */
export function useKycDueTonight(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.kycDueTonight(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: DESK_LIST_CHECK,
    queryFn: async (): Promise<KycCandidate[]> => {
      const { data, error } = await client.rpc('kyc_due_tonight', { p_venue_id: venueId }).limit(LIST_MOST);
      if (error) throw error;
      return data.map(candidateOf);
    },
  });
}

/** Why a check in person did not go through, as the console tells it. */
export type KycInPersonFailure = 'not_allowed' | 'decided' | 'no_photo' | 'invalid' | 'stopped' | 'unavailable';

const IN_PERSON_FAILURES: readonly KycInPersonFailure[] = ['not_allowed', 'decided', 'no_photo', 'invalid', 'stopped'];

/** The function's reply as the console tells it; anything else is `unavailable`. */
export function inPersonFailureOf(code: unknown): KycInPersonFailure {
  return IN_PERSON_FAILURES.find((known) => known === code) ?? 'unavailable';
}

/** Where a check in person ended. */
export type KycInPersonOutcome = 'verified' | 'refused' | 'needs_review';

const IN_PERSON_OUTCOMES: readonly KycInPersonOutcome[] = ['verified', 'needs_review'];

/**
 * A check in person (the kyc-in-person Edge Function): photos of the member, their PAN and their Aadhaar
 * front (JPEGs, the Aadhaar's bars already painted in) and the details from their originals. Resolves to where the check ended: `verified`, `refused` (the gate refuses
 * under 18 and a PAN or Aadhaar a verified member holds) or `needs_review` (another check holds the
 * same PAN, Aadhaar or face); or why it did not go through. Then reloads the queue.
 */
export function useKycInPerson(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const check = useMutation({
    mutationFn: async ({ photo, panPhoto, aadhaarPhoto, ...details }: KycInPerson & { photo: Blob; panPhoto: Blob; aadhaarPhoto: Blob }): Promise<Result<KycInPersonOutcome, KycInPersonFailure>> => {
      const [image, panImage, aadhaarImage] = await Promise.all([toBase64(photo), toBase64(panPhoto), toBase64(aadhaarPhoto)]);
      const { data, error } = await client.functions.invoke('kyc-in-person', { body: { ...details, image, panImage, aadhaarImage } });
      const user = userId ?? 'signed-out';
      // The queue, which now holds a refused check, and the search and tonight's list, which no longer find a decided one.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.kycReview(user, venueId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.kycInPersonSearches(user, venueId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.kycDueTonight(user, venueId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.kycDeskClaims(user, venueId) }),
      ]);
      if (error) return err(inPersonFailureOf(await functionErrorCode(error)));
      const status: unknown = typeof data === 'object' && data !== null ? Reflect.get(data, 'status') : null;
      // Anything else reads as refused, the safe reading.
      return ok(IN_PERSON_OUTCOMES.find((known) => known === status) ?? 'refused');
    },
  });
  return { check };
}
