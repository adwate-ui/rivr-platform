import { rewardKindOf, type RewardKind } from '@rivr/contracts/rewardKinds';
import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';
import type { LeagueBoardRow } from './league.ts';
import { toPaise } from './parse/hands.ts';
import { rewardItemOf, type RewardFailure, type RewardItem } from './rewards.ts';

export type { LeagueBoardRow } from './league.ts';

/** The signed-in member's points and tier, for the top of Rewards (#152). */
export interface MyRewards {
  readonly points: bigint;
  readonly tierName: string;
  /** Hotel nights earned (#146), in thousandths of a night: 1250 is a night and a quarter. */
  readonly nights: bigint;
}

/**
 * One of the member's redemptions: the reward, where to collect it, what it took (points, or for a hotel night whole
 * nights; the other is null), and when it was handed over (null while it waits).
 */
export interface MyRedemption {
  readonly id: string;
  readonly rewardName: string;
  readonly kind: RewardKind;
  readonly detail: string;
  readonly points: bigint | null;
  readonly nights: number | null;
  readonly createdAt: string;
  readonly handedOverAt: string | null;
}

/** A redemption as the member asks for it: the reward, the price they were shown for it (points or nights), and one request id per tap. */
export interface RedeemOrder {
  readonly itemId: string;
  readonly points: bigint | null;
  readonly nights: number | null;
  readonly requestId: string;
}

const FAILURE_BY_CODE: Readonly<Record<string, RewardFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', RVRWD: 'not_on_offer', RVPRC: 'price_changed', RVPTS: 'not_enough_points', RVNGT: 'not_enough_nights', RVMBR: 'stopped', RVKIL: 'switched_off',
  RVFRZ: 'paused',
};

/** The signed-in member's points and tier; null for someone who is no member. */
export function useMyRewards() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myRewards(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<MyRewards | null> => {
      const { data, error } = await client.rpc('my_rewards');
      if (error) throw error;
      const row = data[0];
      return row === undefined ? null : { points: BigInt(row.points), tierName: row.tier_name, nights: BigInt(row.nights) };
    },
  });
}

/** The member's catalogue (rewards.catalogue): their venue's live rewards, cheapest first, hotel nights last; none without the feature. */
export function useRewardCatalogue() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.rewardCatalogue(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<RewardItem[]> => {
      const { data, error } = await client.from('reward_item').select('id, kind, name, detail, points, nights, stock, is_live')
        .eq('is_live', true).order('points').order('name');
      if (error) throw error;
      return data.map(rewardItemOf);
    },
  });
}

/** The member's last twenty redemptions, newest first (rewards.catalogue). */
export function useMyRedemptions() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myRedemptions(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<MyRedemption[]> => {
      const { data, error } = await client.rpc('my_redemptions');
      if (error) throw error;
      return data.map((row) => ({
        id: row.id, rewardName: row.reward_name, kind: rewardKindOf(row.kind), detail: row.detail, points: row.points === null ? null : BigInt(row.points),
        nights: row.nights, createdAt: row.created_at, handedOverAt: row.handed_over_at,
      }));
    },
  });
}

/**
 * The member redeems a reward for the price they were shown (points or nights), once per request id; a Result with the
 * redemption's id. Points, the catalogue (its stock) and the redemptions reload either way.
 */
export function useRedeemReward() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (order: RedeemOrder): Promise<Result<string, RewardFailure>> => {
      const { data, error } = await client.rpc('redeem_reward', {
        p_item_id: order.itemId, p_idempotency_key: order.requestId,
        ...(order.points === null ? {} : { p_points: Number(order.points) }), ...(order.nights === null ? {} : { p_nights: order.nights }),
      });
      const who = userId ?? 'signed-out';
      await Promise.all([queryKeys.myRewards(who), queryKeys.rewardCatalogue(who), queryKeys.myRedemptions(who), queryKeys.wallet(who)]
        .map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(data);
    },
  });
}


interface LeagueBoardRecord {
  standing: string;
  season_name: string | null;
  first_month: string;
  last_month: string;
  place: number;
  display_name: string | null;
  points: number;
  is_me: boolean;
}

/** A board row as the database gives it (my_league, tv_league_board). */
export function toLeagueBoardRow(row: LeagueBoardRecord): LeagueBoardRow {
  return {
    standing: row.standing === 'season' ? 'season' : 'month', seasonName: row.season_name, firstMonth: row.first_month, lastMonth: row.last_month,
    place: row.place, name: row.display_name, points: BigInt(row.points), isMe: row.is_me,
  };
}

/** The signed-in member's League (league.standings): this month's and this season's top ten, and their own place when off it. */
export function useMyLeague() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myLeague(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<LeagueBoardRow[]> => {
      const { data, error } = await client.rpc('my_league');
      if (error) throw error;
      return data.map(toLeagueBoardRow);
    },
  });
}

/**
 * The signed-in member's referral code, RIVR and their number, how many they have referred, and the bonus each side
 * gets now, null while the referral promotion is not running (#151).
 */
export interface MyReferral {
  readonly code: string;
  readonly referred: number;
  readonly bonus: Paise | null;
}

/**
 * The member's referral code for Rewards and their share card; null for someone who is not a member, or whose tier
 * does not have referrals.
 */
export function useMyReferral() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myReferral(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<MyReferral | null> => {
      const { data, error } = await client.rpc('my_referral');
      if (error) throw error;
      const [row] = data;
      if (row === undefined) return null;
      return { code: row.code, referred: row.referred, bonus: row.bonus_paise === null ? null : toPaise(row.bonus_paise) };
    },
  });
}
