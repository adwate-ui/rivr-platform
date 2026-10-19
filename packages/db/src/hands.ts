import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import type { RakeRules } from '@rivr/domain/rake';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise, toRakeRules } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A hand's variant: Hold'em, PLO or a bomb pot. */
export type HandVariant = 'holdem' | 'plo' | 'bomb_pot';

/** The tablet's table rules now: its rake (with @rivr/domain's RakeRules, for potTake) and whether it plays variations. */
export interface TableRules {
  readonly rake: RakeRules;
  readonly hasVariation: boolean;
}

/** One hand of the down at the tablet's table. */
export interface DownHand {
  readonly handId: string;
  readonly playedAt: string;
  readonly variant: HandVariant;
  readonly pot: Paise;
  readonly rake: Paise;
  readonly drop: Paise;
  readonly isCapApplied: boolean;
}

/**
 * Why a hand was not logged: no dealer signed in, the venue frozen, a pot that is not whole ₹50
 * chips (or a variant the table does not play), or anything else.
 */
export type LogHandFailure = 'no_dealer' | 'paused' | 'invalid' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, LogHandFailure>> = { RVDWN: 'no_dealer', RVFRZ: 'paused', '22023': 'invalid' };

/** The rules for the tablet's table now, so it shows the rake, drop and pull as the pot is typed. */
export function useTableRules() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tableRules(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<TableRules | null> => {
      const { data, error } = await client.rpc('tablet_rake_rules');
      if (error) throw error;
      const row = data[0];
      return row ? { rake: toRakeRules(row), hasVariation: row.has_variation } : null;
    },
  });
}

/** The hands of the current down at the tablet's table, latest first. */
export function useDownHands() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.downHands(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<DownHand[]> => {
      const { data, error } = await client.rpc('down_hands');
      if (error) throw error;
      return data.map((row) => ({
        handId: row.hand_id, playedAt: row.played_at, variant: row.variant, pot: toPaise(row.pot_paise),
        rake: toPaise(row.rake_paise), drop: toPaise(row.drop_paise), isCapApplied: row.is_cap_applied,
      }));
    },
  });
}

/**
 * Logs a hand (#42): the pot, the variant, when it was played, and the request id of the tap, so a
 * retried tap logs it once. Resolves to the hand's id or why not, and reloads the down's hands.
 */
export function useLogHand() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (hand: { pot: Paise; variant: HandVariant; playedAt: Date; requestId: string }): Promise<Result<string, LogHandFailure>> => {
      const { data, error } = await client.rpc('log_hand', {
        p_pot: Number(hand.pot), p_variant: hand.variant, p_played_at: hand.playedAt.toISOString(), p_idempotency_key: hand.requestId,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.downHands(userId ?? 'signed-out') });
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(data);
    },
  });
}
