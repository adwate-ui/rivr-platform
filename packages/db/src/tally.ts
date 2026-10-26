import { err, ok, type Result } from '@rivr/contracts/result';
import type { TallyLedger } from '@rivr/contracts/tally';
import type { TallyPosting } from '@rivr/domain/tally';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/tally), off the player's first load.
const keys = {
  tallyAccounts: (userId: string, venueId: string) => ['user', userId, 'tally-accounts', venueId] as const,
};

/** A money account code (#96), its venue account's name (null when only members hold it), and its Tally ledger, null until mapped. */
export interface TallyAccount {
  readonly accountCode: string;
  readonly accountName: string | null;
  readonly tallyLedger: string | null;
}

/**
 * Why a Tally action did not go through: not a treasury manager, a day not yet ended or the practice venue, the venue
 * frozen (a mapping waits for its release), or anything else.
 */
export type TallyFailure = 'not_allowed' | 'invalid' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, TallyFailure>> = { '42501': 'not_allowed', '22023': 'invalid', RVFRZ: 'paused' };

/** The venue's money account codes with their Tally ledgers, for treasury managers. */
export function useTallyAccounts(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.tallyAccounts(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<TallyAccount[]> => {
      const { data, error } = await client.rpc('tally_accounts', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({ accountCode: row.account_code, accountName: row.account_name, tallyLedger: row.tally_ledger }));
    },
  });
}

/** Maps an account code to a Tally ledger, or changes it, then reloads the accounts. */
export function useSetTallyLedger(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ accountCode, tallyLedger }: TallyLedger): Promise<Result<null, TallyFailure>> => {
      const { error } = await client.rpc('set_tally_ledger', { p_venue_id: venueId, p_account_code: accountCode, p_tally_ledger: tallyLedger });
      await queryClient.invalidateQueries({ queryKey: keys.tallyAccounts(userId ?? 'signed-out', venueId) });
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
}

/** Takes a club day's postings for Tally (`2026-11-15`; audited each time), a Result. */
export function useTallyDay(venueId: string) {
  const { client } = useRivrData();
  return useMutation({
    mutationFn: async (day: string): Promise<Result<TallyPosting[], TallyFailure>> => {
      const { data, error } = await client.rpc('tally_day', { p_venue_id: venueId, p_day: day });
      if (error) return err(FAILURE_BY_CODE[error.code] ?? 'unavailable');
      return ok(data.map((row) => ({ kind: row.kind, accountCode: row.account_code, tallyLedger: row.tally_ledger, amount: toPaise(row.amount_paise) })));
    },
  });
}
