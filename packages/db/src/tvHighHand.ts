import { rewardSchema } from '@rivr/contracts/promotionModel';
import type { HighHandReward } from '@rivr/domain/promotions';
import { useQuery } from '@tanstack/react-query';
import type { Json } from './database.types.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A payout on the TV's High hand bonus board: who, the hand as it was paid, where, when and how much. */
export interface TvHighHandPayout {
  readonly id: string;
  readonly at: string;
  /** A first name and initial; null for a member who hid their name on the TVs (#326), who has their member number. */
  readonly name: string | null;
  readonly memberNumber: number | null;
  readonly hand: string;
  readonly rank: string | null;
  readonly table: string;
  readonly chips: number;
}

/** The TV's High hand bonus board (redesign RD-25): the promotion's name, its hands and rules, and tonight's payouts, newest first. */
export interface TvHighHand {
  readonly promotionId: string;
  readonly name: string;
  readonly reward: HighHandReward;
  readonly payouts: readonly TvHighHandPayout[];
}

const textOf = (value: Json | undefined) => (typeof value === 'string' ? value : null);

/** One payout from the board's own JSON; null for anything that is not one. */
function payoutOf(value: Json): TvHighHandPayout | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { id, at, hand, table, chips, member_number: memberNumber } = value;
  if (typeof id !== 'string' || typeof at !== 'string' || typeof hand !== 'string' || typeof table !== 'string' || typeof chips !== 'number') return null;
  return { id, at, hand, table, chips, name: textOf(value['name']), rank: textOf(value['rank']), memberNumber: typeof memberNumber === 'number' ? memberNumber : null };
}

interface BoardRow {
  promotion_id: string;
  name: string;
  reward: Json;
  payouts: Json;
}

/** The board as the TV shows it; null while no high hand runs, or when its reward cannot be read as one. */
export function toTvHighHand(rows: readonly BoardRow[]): TvHighHand | null {
  const row = rows[0];
  const reward = rewardSchema.safeParse(row?.reward);
  if (row === undefined || !reward.success || reward.data.kind !== 'high_hand') return null;
  const payouts = Array.isArray(row.payouts) ? row.payouts.map(payoutOf).filter((payout) => payout !== null) : [];
  return { promotionId: row.promotion_id, name: row.name, reward: reward.data, payouts };
}

// Realtime tells the TV when a hand is paid (useTvSignals); it also asks again every half minute, in case a signal is
// missed, and to learn that a high hand went live or stopped.
const BOARD_CHECK = 30_000;

/**
 * The signed-in TV's High hand bonus board at its venue (`tv_high_hand`): null while no high hand runs or it is not shown
 * on the TVs, so the TV moves on to its next board.
 */
export function useTvHighHand() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tvHighHand(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: BOARD_CHECK,
    queryFn: async (): Promise<TvHighHand | null> => {
      const { data, error } = await client.rpc('tv_high_hand');
      if (error) throw error;
      return toTvHighHand(data);
    },
  });
}
