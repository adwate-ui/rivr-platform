import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/spin). The TV's board is in queryKeys, for useTvSignals.
const keys = {
  wheel: (userId: string, venueId: string) => ['user', userId, 'spin-wheel', venueId] as const,
  waiting: (userId: string, venueId: string) => ['user', userId, 'spins-waiting', venueId] as const,
};

/** What a prize on the wheel gives: points, bonus, or nothing. */
export type SpinPrizeKind = 'points' | 'bonus' | 'nothing';
const KINDS: readonly SpinPrizeKind[] = ['points', 'bonus', 'nothing'];
const kindOf = (kind: string): SpinPrizeKind => KINDS.find((each) => each === kind) ?? 'nothing';

/** A prize on the wheel (#150): points, bonus in paise, or nothing (amount 0); its weight, its odds among the others; and
 * whether it can be drawn now: a bonus only while this month's spin budget covers it. */
export interface SpinPrize {
  readonly prizeId: string;
  readonly kind: SpinPrizeKind;
  readonly amount: bigint;
  readonly weight: number;
  readonly isDrawable: boolean;
}

/** A member's spin not yet spun, from a promotion's spin effect. */
export interface WaitingSpin {
  readonly grantId: string;
  readonly memberName: string;
  readonly promotionName: string;
  readonly grantedAt: string;
}

/** Why the wheel did not change or spin: the role, out of bounds, already spun or gone, no prize the budget allows, frozen, or anything else. */
export type SpinFailure = 'not_allowed' | 'invalid' | 'gone' | 'no_prize' | 'paused' | 'unavailable';
const FAILURE_BY_CODE: Readonly<Record<string, SpinFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', P0002: 'gone', RVSPN: 'no_prize', RVFRZ: 'paused', RVKIL: 'paused', RVMBR: 'paused',
};
const failureOf = (code: string): SpinFailure => FAILURE_BY_CODE[code] ?? 'unavailable';

/** The wheel's prizes in order, for the floor and staff who run promotions. */
export function useSpinWheel(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.wheel(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<SpinPrize[]> => {
      const { data, error } = await client.rpc('spin_prizes', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({ prizeId: row.prize_id, kind: kindOf(row.kind), amount: BigInt(row.amount), weight: row.weight, isDrawable: row.is_drawable }));
    },
  });
}

/** Adding a prize to the end of the wheel, and taking one off, for staff who run promotions; each a Result, and the wheel reloads. */
export function useSpinWheelActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const reload = () => queryClient.invalidateQueries({ queryKey: keys.wheel(userId ?? 'signed-out', venueId) });
  const add = useMutation({
    mutationFn: async (prize: { kind: SpinPrizeKind; amount: bigint; weight: number }): Promise<Result<string, SpinFailure>> => {
      const { data, error } = await client.rpc('add_spin_prize', { p_venue_id: venueId, p_kind: prize.kind, p_amount: Number(prize.amount), p_weight: prize.weight });
      await reload();
      return error ? err(failureOf(error.code)) : ok(data);
    },
  });
  const remove = useMutation({
    mutationFn: async (prizeId: string): Promise<Result<null, SpinFailure>> => {
      const { error } = await client.rpc('remove_spin_prize', { p_venue_id: venueId, p_prize_id: prizeId });
      await reload();
      return error ? err(failureOf(error.code)) : ok(null);
    },
  });
  return { add, remove };
}

/** The spins waiting to be spun, oldest first, for the floor. */
export function useWaitingSpins(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.waiting(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<WaitingSpin[]> => {
      const { data, error } = await client.rpc('waiting_spins', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({ grantId: row.grant_id, memberName: row.member_name, promotionName: row.promotion_name, grantedAt: row.granted_at }));
    },
  });
}

/** Spins the wheel for a waiting spin: the prize won (posted as points or bonus), or why not; the spins waiting reload. */
export function useSpin(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (grantId: string): Promise<Result<{ kind: SpinPrizeKind; amount: bigint }, SpinFailure>> => {
      const { data, error } = await client.rpc('spin_the_wheel', { p_venue_id: venueId, p_grant_id: grantId });
      await queryClient.invalidateQueries({ queryKey: keys.waiting(userId ?? 'signed-out', venueId) });
      const won = data?.[0];
      if (error || won === undefined) return err(error ? failureOf(error.code) : 'unavailable');
      return ok({ kind: kindOf(won.kind), amount: BigInt(won.amount) });
    },
  });
}

/** The TV's spin wheel (#150): the prizes in order, and tonight's last spins, newest first, a hidden name as null. */
export interface TvSpinWheel {
  readonly prizes: readonly { readonly kind: SpinPrizeKind; readonly amount: bigint; readonly weight: number }[];
  readonly spins: readonly { readonly name: string | null; readonly kind: SpinPrizeKind; readonly amount: bigint }[];
}

// A spin tells the TV at once (useTvSignals); it also asks again every half minute.
const TV_BOARD_CHECK = 30_000;

/** The paired TV's spin wheel, while it is its mode or in its rotation; empty otherwise. Only prizes the budget allows come. */
export function useTvSpinWheel() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tvSpinWheel(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: TV_BOARD_CHECK,
    queryFn: async (): Promise<TvSpinWheel> => {
      const { data, error } = await client.rpc('tv_spin_wheel');
      if (error) throw error;
      return {
        prizes: data.filter((row) => row.row_kind === 'prize').map((row) => ({ kind: kindOf(row.prize_kind), amount: BigInt(row.amount), weight: row.weight })),
        spins: data.filter((row) => row.row_kind === 'spin').map((row) => ({ name: row.display_name, kind: kindOf(row.prize_kind), amount: BigInt(row.amount) })),
      };
    },
  });
}
