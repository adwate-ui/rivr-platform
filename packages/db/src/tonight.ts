import { useQuery } from '@tanstack/react-query';
import type { Database } from './database.types.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** The next published tournament at the member's venue. */
export interface NextTournament {
  readonly name: string;
  readonly startsAt: string;
  /** The whole buy-in, fee included, in paise. */
  readonly buyIn: bigint;
  /** The prize pool the club guarantees, in paise; null for none. */
  readonly guarantee: bigint | null;
}

/** Home's tonight for the signed-in member (#87, decision 0116). */
export interface MyTonight {
  /** Whether their identity check is done: Join needs it. */
  readonly isKycComplete: boolean;
  /** The bad-beat jackpot at their venue, in paise, with the live floor; null without it. */
  readonly jackpot: bigint | null;
  /** With tournament registration; null without it, or when none is coming. */
  readonly nextTournament: NextTournament | null;
}

type TonightRow = Database['public']['Functions']['my_tonight']['Returns'][number];

/** One row of `my_tonight` as Home reads it. */
export function toMyTonight(row: TonightRow): MyTonight {
  const { tournament_name: name, tournament_starts_at: startsAt, tournament_buy_in_paise: buyIn, tournament_guarantee_paise: guarantee } = row;
  const nextTournament = name === null || startsAt === null || buyIn === null ? null
    : { name, startsAt, buyIn: BigInt(buyIn), guarantee: guarantee === null ? null : BigInt(guarantee) };
  return { isKycComplete: row.is_kyc_complete, jackpot: row.jackpot_paise === null ? null : BigInt(row.jackpot_paise), nextTournament };
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
