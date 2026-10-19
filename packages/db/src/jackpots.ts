import { err, ok, type Result } from '@rivr/contracts/result';
import type { PayoutRule } from '@rivr/domain/jackpot';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { toPayoutRule } from './parse/jackpots.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** The venue's jackpot: its three pools now, and the payout rule in force (null when none is set). */
export interface Jackpot {
  readonly main: Paise;
  readonly season: Paise;
  readonly freeroll: Paise;
  readonly rule: PayoutRule | null;
  readonly events: readonly JackpotEvent[];
}

/** A payout, or the reversal of one, latest first. */
export interface JackpotEvent {
  readonly eventId: string;
  readonly kind: 'payout' | 'reversal';
  readonly isReversed: boolean;
  readonly tableName: string | null;
  readonly loserName: string | null;
  readonly winnerName: string | null;
  readonly others: number;
  readonly loser: Paise;
  readonly winner: Paise;
  readonly eachAtTable: Paise;
  readonly total: Paise;
  readonly reason: string | null;
  readonly createdAt: string;
}

/**
 * Why a payout or a reversal did not go through: the role does not pay jackpots; a player is not a
 * member here; the details were refused (a table elsewhere, a player twice, no payout rule, a pool
 * too small to pay a chip); the venue frozen; promotions switched off; the payout already reversed;
 * or anything else.
 */
export type JackpotFailure = 'not_allowed' | 'not_member' | 'invalid' | 'paused' | 'switched_off' | 'already_reversed' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, JackpotFailure>> = {
  '42501': 'not_allowed', RVNMB: 'not_member', '22023': 'invalid', RVFRZ: 'paused', RVKIL: 'switched_off', RVDUP: 'already_reversed',
};

// The pools move with every hand, so the screen asks again every half minute.
const POOLS_CHECK = 30_000;

/** The venue's jackpot (#48) for staff who pay jackpots or read the ledger: pools, rule and history. */
export function useJackpot(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.jackpot(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: POOLS_CHECK,
    queryFn: async (): Promise<Jackpot> => {
      const [pools, history] = await Promise.all([
        client.rpc('jackpot_pools', { p_venue_id: venueId }),
        client.rpc('jackpot_history', { p_venue_id: venueId }),
      ]);
      if (pools.error) throw pools.error;
      if (history.error) throw history.error;
      // An aggregate: always one row.
      const row = pools.data[0];
      if (row === undefined) throw new Error('jackpot_pools gave no row');
      return {
        main: toPaise(row.main_paise), season: toPaise(row.season_paise), freeroll: toPaise(row.freeroll_paise),
        rule: toPayoutRule(row.payout_rule),
        events: history.data.map((event) => ({
          eventId: event.event_id, kind: event.kind, isReversed: event.is_reversed, tableName: event.table_name,
          loserName: event.loser_name, winnerName: event.winner_name, others: event.others, loser: toPaise(event.loser_paise),
          winner: toPaise(event.winner_paise), eachAtTable: toPaise(event.each_at_table_paise), total: toPaise(event.total_paise),
          reason: event.reason, createdAt: event.created_at,
        })),
      };
    },
  });
}

/** A bad beat to pay: the table, and the players by mobile number (+91…). */
export interface BadBeat {
  readonly tableId: string;
  readonly loserPhone: string;
  readonly winnerPhone: string;
  readonly otherPhones: readonly string[];
  readonly requestId: string;
}

/**
 * Staff with jackpots.approve `pay` a bad beat (the database works out the payout on the pool as it
 * stands) and `reverse` a payout made in error, with a reason. Both reload the jackpot.
 */
export function useJackpotActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const reload = () => queryClient.invalidateQueries({ queryKey: queryKeys.jackpot(userId ?? 'signed-out', venueId) });
  const pay = useMutation({
    mutationFn: async (beat: BadBeat): Promise<Result<string, JackpotFailure>> => {
      const { data, error } = await client.rpc('pay_bad_beat', {
        p_venue_id: venueId, p_table_id: beat.tableId, p_loser_phone: beat.loserPhone, p_winner_phone: beat.winnerPhone,
        p_table_phones: [...beat.otherPhones], p_idempotency_key: beat.requestId,
      });
      await reload();
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(data);
    },
  });
  const reverse = useMutation({
    mutationFn: async ({ eventId, reason, requestId }: { eventId: string; reason: string; requestId: string }): Promise<Result<string, JackpotFailure>> => {
      const { data, error } = await client.rpc('reverse_jackpot_event', { p_event_id: eventId, p_reason: reason, p_idempotency_key: requestId });
      await reload();
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(data);
    },
  });
  return { pay, reverse };
}
