import { useQuery } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** Home's tonight for the signed-in member (#87, decision 0116). */
export interface MyTonight {
  /** Whether their identity check is done: Join needs it. */
  readonly isKycComplete: boolean;
  /** The bad-beat jackpot at their venue, in paise, with the live floor; null without it. */
  readonly jackpot: bigint | null;
}

/** A `my_tonight` row as the database gives it: the generated types call every column non-null, and the jackpot is not. */
interface TonightRow {
  is_kyc_complete: boolean;
  jackpot_paise: number | null;
}

/** One row of `my_tonight` as Home reads it. */
export function toMyTonight(row: TonightRow): MyTonight {
  return { isKycComplete: row.is_kyc_complete, jackpot: row.jackpot_paise === null ? null : BigInt(row.jackpot_paise) };
}

/** The signed-in member's tonight on Home, asked every minute; null for someone who is no member. */
export function useMyTonight() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myTonight(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: 60_000,
    queryFn: async (): Promise<MyTonight | null> => {
      const { data, error } = await client.rpc('my_tonight');
      if (error) throw error;
      const row = data[0];
      return row === undefined ? null : toMyTonight(row);
    },
  });
}
