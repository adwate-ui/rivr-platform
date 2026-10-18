import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toKycFailure, type KycFailure } from './parse/kycFailure.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/**
 * Where a member's identity check stands. `needs_review` waits for staff (a PAN alone, or someone
 * else's documents); `refused` is under 18 or an identity another member already holds.
 */
export type KycStatus = 'started' | 'needs_pan' | 'needs_review' | 'verified' | 'refused';

/** What the member sees of their own check: never more than the masked Aadhaar. */
export interface KycRecord {
  readonly status: KycStatus;
  /** Whether the selfie, the KYC photo, is in: DigiLocker comes next. */
  readonly hasSelfie: boolean;
  readonly dateOfBirth: string | null;
  readonly maskedAadhaar: string | null;
  readonly pan: string | null;
}

const STATUSES: readonly KycStatus[] = ['started', 'needs_pan', 'needs_review', 'verified', 'refused'];

function toStatus(value: unknown): KycStatus | null {
  return STATUSES.find((status) => status === value) ?? null;
}

/** A photo as base64, for a KYC function's JSON body (kyc, kyc-in-person). */
export async function toBase64(photo: Blob): Promise<string> {
  const bytes = new Uint8Array(await photo.arrayBuffer());
  let binary = '';
  for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return btoa(binary);
}

/** The signed-in member's KYC record, or null before their first check. */
export function useKycRecord() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.kycRecord(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<KycRecord | null> => {
      const { data, error } = await client.from('kyc_record').select('status, photo_path, date_of_birth, masked_aadhaar, pan').maybeSingle();
      if (error) throw error;
      const status = toStatus(data?.status);
      if (data === null || status === null) return null;
      return { status, hasSelfie: data.photo_path !== null, dateOfBirth: data.date_of_birth, maskedAadhaar: data.masked_aadhaar, pan: data.pan };
    },
  });
}

/**
 * The member's identity check, through the kyc Edge Function: `sendSelfie` sends the selfie (a JPEG),
 * `start` gives the DigiLocker URL to send them to (the function fixes where DigiLocker sends them
 * back), `complete` pulls the record once they are back, `verifyPan` checks a PAN when DigiLocker
 * failed or held none. Each resolves to a Result; a real venue without vendor keys gets `not_configured`.
 */
export function useKycActions() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();

  async function invoke(body: object): Promise<Result<Record<string, unknown>, KycFailure>> {
    const { data, error } = await client.functions.invoke('kyc', { body });
    if (error) return err(await toKycFailure(error));
    await queryClient.invalidateQueries({ queryKey: queryKeys.kycRecord(userId ?? 'signed-out') });
    return ok(typeof data === 'object' && data !== null ? Object.fromEntries(Object.entries(data)) : {});
  }
  const statusOf = (fallback: KycStatus) => (sent: Result<Record<string, unknown>, KycFailure>) =>
    sent.ok ? ok(toStatus(sent.value.status) ?? fallback) : sent;

  const sendSelfie = useMutation({
    mutationFn: async (photo: Blob) => statusOf('started')(await invoke({ action: 'selfie', image: await toBase64(photo) })),
  });
  const start = useMutation({
    mutationFn: async (): Promise<Result<string, KycFailure>> => {
      const started = await invoke({ action: 'start' });
      return started.ok ? ok(String(started.value.redirectUrl)) : started;
    },
  });
  const complete = useMutation({ mutationFn: async () => statusOf('started')(await invoke({ action: 'complete' })) });
  const verifyPan = useMutation({
    mutationFn: async (input: { pan: string; dateOfBirth?: string }) => statusOf('needs_pan')(await invoke({ action: 'pan', ...input })),
  });
  return { sendSelfie, start, complete, verifyPan };
}
