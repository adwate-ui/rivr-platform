import { err, ok, type Result } from '@rivr/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toKycFailure, type KycFailure } from './parse/kycFailure.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** Where a member's identity check stands; `needs_review` is a PAN alone, waiting for staff. */
export type KycStatus = 'started' | 'needs_pan' | 'needs_review' | 'verified';

/** What the member sees of their own check: never more than the masked Aadhaar. */
export interface KycRecord {
  readonly status: KycStatus;
  readonly dateOfBirth: string | null;
  readonly maskedAadhaar: string | null;
  readonly pan: string | null;
}

const STATUSES: readonly KycStatus[] = ['started', 'needs_pan', 'needs_review', 'verified'];

function toStatus(value: unknown): KycStatus | null {
  return STATUSES.find((status) => status === value) ?? null;
}

/** The signed-in member's KYC record, or null before their first check. */
export function useKycRecord() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.kycRecord(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<KycRecord | null> => {
      const { data, error } = await client.from('kyc_record').select('status, date_of_birth, masked_aadhaar, pan').maybeSingle();
      if (error) throw error;
      const status = toStatus(data?.status);
      if (data === null || status === null) return null;
      return { status, dateOfBirth: data.date_of_birth, maskedAadhaar: data.masked_aadhaar, pan: data.pan };
    },
  });
}

/**
 * The member's identity check, through the kyc Edge Function: `start` gives the DigiLocker URL to
 * send them to (the function fixes where DigiLocker sends them back), `complete` pulls the record
 * once they are back, `verifyPan` checks a PAN when DigiLocker failed or held none. Each resolves
 * to a Result; a real venue without vendor keys gets `not_configured`.
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

  const start = useMutation({
    mutationFn: async (): Promise<Result<string, KycFailure>> => {
      const started = await invoke({ action: 'start' });
      return started.ok ? ok(String(started.value.redirectUrl)) : started;
    },
  });
  const complete = useMutation({
    mutationFn: async (): Promise<Result<KycStatus, KycFailure>> => {
      const completed = await invoke({ action: 'complete' });
      return completed.ok ? ok(toStatus(completed.value.status) ?? 'started') : completed;
    },
  });
  const verifyPan = useMutation({
    mutationFn: async (input: { pan: string; dateOfBirth?: string }): Promise<Result<KycStatus, KycFailure>> => {
      const checked = await invoke({ action: 'pan', ...input });
      return checked.ok ? ok(toStatus(checked.value.status) ?? 'needs_pan') : checked;
    },
  });
  return { start, complete, verifyPan };
}
