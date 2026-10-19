import type { HighHandCategory } from '@rivr/contracts';
import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

type HighHandStatus = 'claimed' | 'approved' | 'rejected';

/** A high-hand claim from this tablet (#47): which hand, what was claimed, and the floor's decision so far. */
export interface TabletHighHand {
  readonly claimId: string;
  readonly handId: string;
  readonly category: HighHandCategory;
  readonly seat: number;
  readonly status: HighHandStatus;
}

/** One of the venue's high hands, as the console lists them, latest first. */
export interface HighHand {
  readonly claimId: string;
  readonly status: HighHandStatus;
  readonly category: HighHandCategory;
  /** The rank of a four of a kind, as the tablet keeps it (Q for Queens); null otherwise. */
  readonly rank: string | null;
  readonly seat: number;
  readonly tableName: string;
  readonly playedAt: string;
  /** What was paid; for a claim still waiting, what it pays now; null when it pays nothing. */
  readonly payout: Paise | null;
  readonly dealerName: string;
  readonly decidedByName: string | null;
  readonly reason: string | null;
}

/** Why the floor's decision did not go through: `changed` is a payout that moved since it was shown. */
export type HighHandFailure = 'not_allowed' | 'decided' | 'changed' | 'paused' | 'switched_off' | 'invalid' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, HighHandFailure>> = {
  '42501': 'not_allowed', RVDUP: 'decided', RVSTL: 'changed', RVFRZ: 'paused', RVKIL: 'switched_off', '22023': 'invalid',
};

// The console's list asks again every ten seconds, so a claim from a tablet shows on its own; the
// tablet's claims every fifteen, so the dealer sees the floor's decision.
const LIST_CHECK = 10_000;
const TABLET_CHECK = 15_000;

/** This tablet's high-hand claims, latest first: its own only, as row-level security allows. */
export function useTabletHighHands() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tabletHighHands(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: TABLET_CHECK,
    queryFn: async (): Promise<TabletHighHand[]> => {
      const { data, error } = await client.from('high_hand_claim').select('id, hand_id, category, seat, status')
        .order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data.map((row) => ({ claimId: row.id, handId: row.hand_id, category: row.category, seat: row.seat, status: row.status }));
    },
  });
}

/** The venue's high hands, for staff who approve jackpots or read the ledger. */
export function useHighHands(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.highHands(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: LIST_CHECK,
    queryFn: async (): Promise<HighHand[]> => {
      const { data, error } = await client.rpc('high_hands', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        claimId: row.claim_id, status: row.status, category: row.category, rank: row.rank, seat: row.seat, tableName: row.table_name,
        playedAt: row.played_at, payout: row.payout_paise ? toPaise(row.payout_paise) : null, dealerName: row.dealer_name,
        decidedByName: row.decided_by_name, reason: row.reason,
      }));
    },
  });
}

/**
 * The floor's decision on a claim: `approve` pays the amount the console showed, `reject` gives the
 * reason. Each resolves to a Result and reloads the list.
 */
export function useHighHandActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async (error: { code: string } | null): Promise<Result<null, HighHandFailure>> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.highHands(userId ?? 'signed-out', venueId) });
    return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
  };
  const approve = useMutation({
    mutationFn: async ({ claimId, payout }: { claimId: string; payout: Paise }) =>
      settle((await client.rpc('approve_high_hand', { p_claim_id: claimId, p_expected_paise: Number(payout) })).error),
  });
  const reject = useMutation({
    mutationFn: async ({ claimId, reason }: { claimId: string; reason: string }) =>
      settle((await client.rpc('reject_high_hand', { p_claim_id: claimId, p_reason: reason.trim() })).error),
  });
  return { approve, reject };
}
