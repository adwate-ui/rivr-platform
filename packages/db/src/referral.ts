import type { Paise } from '@rivr/domain/money';
import { useQuery } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';
import { LIST_MOST } from './limits.ts';

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
 * The member's referral code for Bonus and their share card; null for someone who is not a member, or whose tier
 * does not have referrals.
 */
export function useMyReferral() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myReferral(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<MyReferral | null> => {
      const { data, error } = await client.rpc('my_referral').limit(LIST_MOST);
      if (error) throw error;
      const [row] = data;
      if (row === undefined) return null;
      return { code: row.code, referred: row.referred, bonus: row.bonus_paise === null ? null : toPaise(row.bonus_paise) };
    },
  });
}
