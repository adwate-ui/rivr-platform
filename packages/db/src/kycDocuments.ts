import { KYC_DOCUMENT_KINDS, type KycDocumentKind, type KycDocumentRetake } from '@rivr/contracts';
import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toBase64 } from './kyc.ts';
import { inPersonFailureOf, oneOf, type KycInPersonFailure } from './kycReview.ts';
import { functionErrorCode } from './parse/kycFailure.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/**
 * A photo of a member's PAN or Aadhaar front on file, as a super admin sees it (decision 0573). `path` opens with
 * `useKycImageUrl`, and each opening goes in the audit log.
 */
export interface KycDocument {
  readonly kind: KycDocumentKind;
  readonly path: string;
  readonly takenAt: string;
  readonly takenBy: string;
  /** Who said the bars hide what they must; null for a PAN, which is kept whole. */
  readonly coversConfirmedBy: string | null;
  /** While a super admin has sent it back and the desk has not taken it again. */
  readonly retakeAskedAt: string | null;
  readonly retakeReason: string | null;
}

interface DocumentRow {
  kind: string;
  path: string;
  taken_at: string;
  taken_by: string;
  covers_confirmed_by: string | null;
  retake_asked_at: string | null;
  retake_reason: string | null;
}

const documentOf = (row: DocumentRow): KycDocument => ({
  kind: oneOf(KYC_DOCUMENT_KINDS, row.kind), path: row.path, takenAt: row.taken_at, takenBy: row.taken_by,
  coversConfirmedBy: row.covers_confirmed_by, retakeAskedAt: row.retake_asked_at, retakeReason: row.retake_reason,
});

/** A member's PAN and Aadhaar photos on file. Empty for anyone but a super admin. */
export function useMemberKycDocuments(venueId: string, memberId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.memberKycDocuments(userId ?? 'signed-out', venueId, memberId),
    enabled: userId !== null,
    queryFn: async (): Promise<KycDocument[]> => {
      const { data, error } = await client.rpc('member_kyc_documents', { p_venue_id: venueId, p_member_id: memberId });
      if (error) throw error;
      return data.map(documentOf);
    },
  });
}

/** Why a photo could not be sent back. */
export type KycSendBackFailure = 'not_allowed' | 'invalid' | 'unavailable';

const SEND_BACK_FAILURES: Readonly<Record<string, KycSendBackFailure>> = { '42501': 'not_allowed', '22023': 'invalid' };

/** A super admin sends a photo back, saying why: the member is due at the desk for that photo alone. */
export function useSendBackKycDocument(venueId: string, memberId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, reason }: { kind: KycDocumentKind; reason: string }): Promise<Result<'sent_back', KycSendBackFailure>> => {
      const { error } = await client.rpc('ask_kyc_document_retake', { p_member_id: memberId, p_kind: kind, p_reason: reason });
      await queryClient.invalidateQueries({ queryKey: queryKeys.memberKycDocuments(userId ?? 'signed-out', venueId, memberId) });
      return error ? err(SEND_BACK_FAILURES[error.code] ?? 'unavailable') : ok('sent_back');
    },
  });
}

/** The desk takes a sent-back photo again (the kyc-in-person Edge Function), which replaces the one on file. */
export function useKycDocumentRetake(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ photo, ...details }: KycDocumentRetake & { photo: Blob }): Promise<Result<'retaken', KycInPersonFailure>> => {
      const { error } = await client.functions.invoke('kyc-in-person', { body: { ...details, image: await toBase64(photo) } });
      const user = userId ?? 'signed-out';
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.kycInPersonSearches(user, venueId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.kycDueTonight(user, venueId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.memberKycDocuments(user, venueId, details.memberId) }),
      ]);
      return error ? err(inPersonFailureOf(await functionErrorCode(error))) : ok('retaken');
    },
  });
}
