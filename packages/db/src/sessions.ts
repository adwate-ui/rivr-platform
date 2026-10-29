import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/sessions), off the player's first load.
const keys = {
  mySessions: (userId: string) => ['user', userId, 'my-sessions'] as const,
};

/**
 * One closed visit of the signed-in member's at which they sat (#127): the table played longest, the hours, the money,
 * and its club month's totals. Net is what came out less the TDS and what went in; what went in counts chips on credit
 * and not bonus chips, which show apart.
 */
const TDS_BASES = ['session', 'day', 'financial_year'] as const;
export type TdsBasis = (typeof TDS_BASES)[number];

export interface MySession {
  /** The visit's id, or the tournament's for a tournament (#549). */
  readonly visitId: string;
  /** A cash-table visit, or a tournament the member played (#549): its name is `tableName`, its stakes nothing. */
  readonly kind: 'cash' | 'tournament';
  /** A tournament's place, when known, and how many played it; null for a cash visit. */
  readonly place: number | null;
  readonly entrants: number | null;
  readonly openedAt: string;
  readonly closedAt: string;
  readonly tableName: string;
  readonly smallBlind: Paise;
  readonly bigBlind: Paise;
  /** How many other tables they played that visit. */
  readonly otherTables: number;
  readonly playedSeconds: number;
  readonly buyIn: Paise;
  readonly bonus: Paise;
  readonly cashOut: Paise;
  readonly tds: Paise;
  /** What the TDS was withheld on (#563): the session alone, the day's or this financial year's winnings; null with none. */
  readonly tdsBasis: TdsBasis | null;
  /** What the cage handed over: the cash-outs less the markers they settled and the TDS. */
  readonly paid: Paise;
  readonly net: Paise;
  /** The last cash-out's receipt, as the cage printed it; null when nothing was cashed out. */
  readonly receipt: string | null;
  /** The club month, `2026-11-01`, and its totals. */
  readonly month: string;
  readonly monthSessions: number;
  readonly monthPlayedSeconds: number;
  readonly monthNet: Paise;
}

/** The signed-in member's sessions, newest first; empty without any, or without sessions.history in their tier. */
export function useMySessions() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.mySessions(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<MySession[]> => {
      const { data, error } = await client.rpc('my_sessions');
      if (error) throw error;
      return data.map((row) => ({
        visitId: row.visit_id, kind: row.kind === 'tournament' ? 'tournament' : 'cash', place: row.place, entrants: row.entrants,
        openedAt: row.opened_at, closedAt: row.closed_at, tableName: row.table_name,
        smallBlind: toPaise(row.small_blind_paise), bigBlind: toPaise(row.big_blind_paise), otherTables: row.other_tables,
        playedSeconds: Number(row.played_seconds), buyIn: toPaise(row.buy_in_paise), bonus: toPaise(row.bonus_paise),
        cashOut: toPaise(row.cash_out_paise), tds: toPaise(row.tds_paise), paid: toPaise(row.paid_paise), net: toPaise(row.net_paise),
        receipt: row.receipt, month: row.month, monthSessions: row.month_sessions, monthPlayedSeconds: Number(row.month_played_seconds),
        monthNet: toPaise(row.month_net_paise), tdsBasis: TDS_BASES.find((basis) => basis === row.tds_basis) ?? null,
      }));
    },
  });
}

/**
 * Hides one of the signed-in member's sessions from their own list (#627); the club keeps its record. Resolves to a
 * Result and reloads the list.
 */
export function useHideMySession() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string): Promise<Result<null, 'unavailable'>> => {
      const { error } = await client.rpc('hide_my_session', { p_session_id: sessionId });
      await queryClient.invalidateQueries({ queryKey: keys.mySessions(userId ?? 'signed-out') });
      return error ? err('unavailable') : ok(null);
    },
  });
}
