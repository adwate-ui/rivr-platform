import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** The cage's open shift (#24): the float counted into the drawer, when it opened and who opened it. */
export interface CageShift {
  readonly shiftId: string;
  readonly float: Paise;
  readonly openedAt: string;
  readonly openedBy: string;
}

/** What the venue holds for players and in play, from the ledger (#24, as the prototype's Treasury), and the open shift. */
export interface Treasury {
  readonly wallets: Paise;
  readonly withdrawalsPending: Paise;
  readonly bonus: Paise;
  readonly markers: Paise;
  readonly jackpots: Paise;
  /** Every chip issued less every chip returned. */
  readonly chipsInPlay: Paise;
  /** Null when no shift is open. */
  readonly shift: CageShift | null;
}

/** One of the venue's chips, with how many the open shift's latest count found: null before a count. */
export interface ChipCountLine {
  readonly value: Paise;
  readonly name: string;
  readonly quantity: number | null;
  readonly total: Paise | null;
}

/** The venue's chips, smallest first, and the open shift's latest count: what the cage holds, when and by whom. */
export interface ChipInventory {
  readonly lines: readonly ChipCountLine[];
  readonly inCage: Paise | null;
  readonly countedAt: string | null;
  readonly countedBy: string | null;
}

/** How many of one chip a cashier counted. */
export interface ChipCount {
  readonly value: Paise;
  readonly quantity: number;
}

/** Why a shift or a count was refused: a shift open already, none open, a count that misses a chip, not a cashier, or the server unreachable. */
export type TreasuryFailure = 'shift_open' | 'no_shift' | 'invalid' | 'not_allowed' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, TreasuryFailure>> = { RVSHO: 'shift_open', RVNSH: 'no_shift', '22023': 'invalid', '42501': 'not_allowed' };

const failureOf = (code: string): TreasuryFailure => FAILURE_BY_CODE[code] ?? 'unavailable';
const asCounts = (counts: readonly ChipCount[]) => counts.map((count) => ({ value_paise: Number(count.value), quantity: count.quantity }));

/** The venue's Treasury, for ledger readers. */
export function useTreasury(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: [...queryKeys.treasury(userId ?? 'signed-out', venueId), 'balances'],
    enabled: userId !== null,
    queryFn: async (): Promise<Treasury> => {
      const { data, error } = await client.rpc('treasury', { p_venue_id: venueId });
      if (error) throw error;
      const row = data[0];
      if (!row) throw new Error('The Treasury is not readable here');
      // A shift's float, opening time and opener are there whenever the shift is.
      const shift = row.shift_id === null ? null
        : { shiftId: row.shift_id, float: toPaise(row.float_paise), openedAt: row.opened_at, openedBy: row.opened_by };
      return {
        wallets: toPaise(row.wallets_paise), withdrawalsPending: toPaise(row.withdrawals_pending_paise), bonus: toPaise(row.bonus_paise),
        markers: toPaise(row.markers_paise), jackpots: toPaise(row.jackpots_paise), chipsInPlay: toPaise(row.chips_in_play_paise), shift,
      };
    },
  });
}

/** The venue's chips and the open shift's latest count of them. */
export function useChipInventory(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: [...queryKeys.treasury(userId ?? 'signed-out', venueId), 'chips'],
    enabled: userId !== null,
    queryFn: async (): Promise<ChipInventory> => {
      const { data, error } = await client.rpc('chip_inventory', { p_venue_id: venueId });
      if (error) throw error;
      return toInventory(data);
    },
  });
}

interface ChipRow {
  value_paise: number;
  name: string;
  quantity: number | null;
  line_paise: number | null;
  in_cage_paise: number | null;
  counted_at: string | null;
  counted_by: string | null;
}

// Every row carries the count's time, counter and total: null on them all before a count.
function toInventory(rows: readonly ChipRow[]): ChipInventory {
  const counted = rows.find((row) => row.counted_at !== null);
  return {
    lines: rows.map((row) => ({
      value: toPaise(row.value_paise), name: row.name, quantity: row.quantity, total: row.line_paise === null ? null : toPaise(row.line_paise),
    })),
    inCage: counted === undefined || counted.in_cage_paise === null ? null : toPaise(counted.in_cage_paise),
    countedAt: counted?.counted_at ?? null,
    countedBy: counted?.counted_by ?? null,
  };
}

/**
 * The cage's steps (#24): `openShift` with the float and a count of every chip, and `countChips` again
 * during it; each once per request id, a Result, reloading the Treasury.
 */
export function useTreasuryActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async (error: { code: string } | null): Promise<Result<null, TreasuryFailure>> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.treasury(userId ?? 'signed-out', venueId) });
    return error ? err(failureOf(error.code)) : ok(null);
  };
  const openShift = useMutation({
    mutationFn: async ({ float, counts, requestId }: { float: Paise; counts: readonly ChipCount[]; requestId: string }) =>
      settle((await client.rpc('open_cage_shift', {
        p_venue_id: venueId, p_float_paise: Number(float), p_counts: asCounts(counts), p_idempotency_key: requestId,
      })).error),
  });
  const countChips = useMutation({
    mutationFn: async ({ counts, requestId }: { counts: readonly ChipCount[]; requestId: string }) =>
      settle((await client.rpc('count_chips', { p_venue_id: venueId, p_counts: asCounts(counts), p_idempotency_key: requestId })).error),
  });
  return { openShift, countChips };
}
