import type { HighHandCategory } from '@rivr/contracts';
import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A reversed claim (#324) was decided once and then set aside; its hand may be claimed again. */
type HighHandStatus = 'claimed' | 'approved' | 'rejected' | 'reversed';

/** A high-hand claim from this tablet (#47): which hand, what was claimed, and the floor's decision so far. */
export interface TabletHighHand {
  readonly claimId: string;
  readonly handId: string;
  readonly category: HighHandCategory;
  readonly seat: number;
  readonly status: HighHandStatus;
  /** The floor corrected the hand, rank or seat the dealer claimed (#324). */
  readonly isCorrected: boolean;
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
  /** What the dealer claimed, when the floor corrected it before deciding (#324), and who corrected it. */
  readonly original: { readonly category: HighHandCategory; readonly rank: string | null; readonly seat: number; readonly byName: string } | null;
  /** Who reversed a decided claim, and why (#324). */
  readonly reversal: { readonly byName: string; readonly reason: string } | null;
}

/**
 * Why the floor's action did not go through: `changed` is a payout that moved since it was shown,
 * `no_seat` a seat the table does not have.
 */
export type HighHandFailure = 'not_allowed' | 'decided' | 'changed' | 'no_seat' | 'paused' | 'switched_off' | 'invalid' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, HighHandFailure>> = {
  '42501': 'not_allowed', RVDUP: 'decided', RVSTL: 'changed', RVSEA: 'no_seat', RVFRZ: 'paused', RVKIL: 'switched_off', '22023': 'invalid',
  '23514': 'invalid',
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
      const { data, error } = await client.from('high_hand_claim').select('id, hand_id, category, seat, status, corrected_at')
        .order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data.map((row) => ({
        claimId: row.id, handId: row.hand_id, category: row.category, seat: row.seat, status: row.status, isCorrected: row.corrected_at !== null,
      }));
    },
  });
}

/**
 * The venue's high hands, for staff who approve jackpots or read the ledger. The console's frame asks with
 * `isEnabled` false for anyone else (#317), and then nothing is asked.
 */
export function useHighHands(venueId: string, isEnabled = true) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.highHands(userId ?? 'signed-out', venueId),
    enabled: userId !== null && isEnabled,
    refetchInterval: LIST_CHECK,
    queryFn: async (): Promise<HighHand[]> => {
      const { data, error } = await client.rpc('high_hands', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        claimId: row.claim_id, status: row.status, category: row.category, rank: row.rank, seat: row.seat, tableName: row.table_name,
        playedAt: row.played_at, payout: row.payout_paise ? toPaise(row.payout_paise) : null, dealerName: row.dealer_name,
        decidedByName: row.decided_by_name, reason: row.reason,
        // A correction and a reversal each name who made them, so the name says whether there was one.
        original: row.corrected_by_name
          ? { category: row.original_category, rank: row.original_rank, seat: row.original_seat, byName: row.corrected_by_name }
          : null,
        reversal: row.reversed_by_name ? { byName: row.reversed_by_name, reason: row.reversed_reason } : null,
      }));
    },
  });
}

/**
 * The floor's actions on a claim: `approve` pays the amount the console showed, `reject` gives the
 * reason; before deciding, `correct` sets the hand, rank and seat (#324); once decided, `reverse` sets
 * it aside with the reason, posting back what was paid. Each resolves to a Result and reloads the list.
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
  const correct = useMutation({
    mutationFn: async ({ claimId, category, rank, seat }: { claimId: string; category: HighHandCategory; rank: string | null; seat: number }) =>
      settle((await client.rpc('correct_high_hand', { p_claim_id: claimId, p_seat: seat, p_category: category, p_rank: rank ?? '' })).error),
  });
  const reverse = useMutation({
    mutationFn: async ({ claimId, reason }: { claimId: string; reason: string }) =>
      settle((await client.rpc('reverse_high_hand', { p_claim_id: claimId, p_reason: reason.trim() })).error),
  });
  return { approve, reject, correct, reverse };
}
