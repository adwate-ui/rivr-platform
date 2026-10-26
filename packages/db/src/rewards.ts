import { rewardKindOf, type RewardKind } from '@rivr/contracts/rewardKinds';
import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A reward in the catalogue (#145, decision 0181): its price in points and, if limited, how many are left (null for no limit). */
export interface RewardItem {
  readonly id: string;
  readonly kind: RewardKind;
  readonly name: string;
  /** Where and how the member collects it: "At the host desk". */
  readonly detail: string;
  readonly points: bigint;
  readonly stock: number | null;
  readonly isLive: boolean;
}

/**
 * A reward as the console saves it: a new one has no id. A change carries the stock the editor was shown
 * (`stockWas`), so a redemption made meanwhile is never written over.
 */
export interface RewardItemOrder {
  readonly itemId: string | null;
  readonly kind: RewardKind;
  readonly name: string;
  readonly detail: string;
  readonly points: number;
  readonly stock: number | null;
  readonly stockWas: number | null;
  readonly isLive: boolean;
}

/** A member's redemption on the console, waiting to be handed over until `handedOverAt`. */
export interface Redemption {
  readonly id: string;
  readonly memberId: string;
  readonly fullName: string;
  readonly memberNumber: number;
  readonly rewardName: string;
  readonly kind: RewardKind;
  readonly points: bigint;
  readonly createdAt: string;
  readonly handedOverAt: string | null;
  readonly handedOverBy: string | null;
}

/**
 * Why a rewards action did not go through: the role does not allow it, a value out of bounds, the stock
 * changed since the editor saw it, handed over already, the reward not on offer or none left, its price
 * changed since the member saw it, not enough points, the member or the venue frozen, or anything else.
 */
export type RewardFailure =
  | 'not_allowed' | 'invalid' | 'stock_changed' | 'handed_over' | 'not_on_offer' | 'price_changed' | 'not_enough_points' | 'stopped' | 'paused'
  | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, RewardFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', RVCHG: 'stock_changed', RVHND: 'handed_over', RVRWD: 'not_on_offer', RVPRC: 'price_changed',
  RVPTS: 'not_enough_points', RVMBR: 'stopped', RVFRZ: 'paused',
};

// The console's list of redemptions asks again every half minute: members redeem from the app at any time.
const REDEMPTIONS_CHECK = 30_000;

interface RewardItemRow {
  id: string;
  kind: string;
  name: string;
  detail: string;
  points: number;
  stock: number | null;
  is_live: boolean;
}

function rewardItemOf(row: RewardItemRow): RewardItem {
  return { id: row.id, kind: rewardKindOf(row.kind), name: row.name, detail: row.detail, points: BigInt(row.points), stock: row.stock, isLive: row.is_live };
}

/** A venue's catalogue as the console keeps it (rewards.manage or rewards.hand_over): live first, cheapest first. */
export function useRewardItems(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.rewardItems(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<RewardItem[]> => {
      const { data, error } = await client.from('reward_item').select('id, kind, name, detail, points, stock, is_live')
        .eq('venue_id', venueId).order('is_live', { ascending: false }).order('points').order('name');
      if (error) throw error;
      return data.map(rewardItemOf);
    },
  });
}

/** Adds a reward to the catalogue or changes one (rewards.manage); a Result with its id, and the catalogue reloads. */
export function useSaveRewardItem(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (order: RewardItemOrder): Promise<Result<string, RewardFailure>> => {
      // A new reward sends no id, and one with no limit no stock: the database reads either left out as none.
      const { data, error } = await client.rpc('save_reward_item', {
        p_venue_id: venueId, p_kind: order.kind, p_name: order.name.trim(), p_detail: order.detail.trim(), p_points: order.points,
        p_is_live: order.isLive, ...(order.itemId === null ? {} : { p_item_id: order.itemId }), ...(order.stock === null ? {} : { p_stock: order.stock }),
        ...(order.stockWas === null ? {} : { p_stock_was: order.stockWas }),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.rewardItems(userId ?? 'signed-out', venueId) });
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(data);
    },
  });
}

/** The venue's redemptions, for staff who hand them over (rewards.hand_over): those waiting first, oldest first, then 30 days handed over. */
export function useVenueRedemptions(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.venueRedemptions(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: REDEMPTIONS_CHECK,
    queryFn: async (): Promise<Redemption[]> => {
      const { data, error } = await client.rpc('venue_redemptions', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        id: row.id, memberId: row.member_id, fullName: row.full_name, memberNumber: row.member_number, rewardName: row.reward_name,
        kind: rewardKindOf(row.kind), points: BigInt(row.points), createdAt: row.created_at, handedOverAt: row.handed_over_at, handedOverBy: row.handed_over_by,
      }));
    },
  });
}

/** Hands a member what they redeemed (rewards.hand_over); a Result, and the list reloads. */
export function useHandOverRedemption(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (redemptionId: string): Promise<Result<null, RewardFailure>> => {
      const { error } = await client.rpc('hand_over_redemption', { p_redemption_id: redemptionId });
      await queryClient.invalidateQueries({ queryKey: queryKeys.venueRedemptions(userId ?? 'signed-out', venueId) });
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
}
