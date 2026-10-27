import { blindLevelsSchema } from '@rivr/contracts/blindLevels';
import { err, ok, type Result } from '@rivr/contracts/result';
import { fromPaise, type Paise } from '@rivr/domain/money';
import { elapsedNow, type ClockReading, type Purchase, type Stage } from '@rivr/domain/tournament';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';
import { toBuyFailure, type BuyFailure } from './tournamentFailures.ts';

/** The field a TV or Home shows (#118): entries, players left, chips in play and the pool. */
export interface LiveField {
  readonly entries: number;
  readonly playersLeft: number;
  readonly chipsInPlay: number;
  readonly pool: Paise;
}

/** A running tournament as a TV sees it (#119): its name, its levels, its clock as read, and its field. */
export interface LiveTournament {
  readonly name: string;
  readonly stages: readonly Stage[];
  readonly clock: ClockReading;
  readonly field: LiveField;
}

/** The member's own latest entry: seated where, an alternate, busted or refunded. */
export interface MyStanding {
  readonly status: 'seated' | 'alternate' | 'busted' | 'refunded';
  readonly table: number | null;
  readonly seat: number | null;
}

/** What the app may sell a member now: an entry, a re-entry or a rebuy. */
export type AppPurchase = Extract<Purchase, 'entry' | 're_entry' | 'rebuy'>;

/** Home's tournament (#118, #119): the one running at the member's club, or the next; their standing, and what they may buy now. */
export interface MyTournament {
  readonly id: string;
  readonly name: string;
  readonly startsAt: string;
  readonly buyIn: Paise;
  readonly guarantee: Paise | null;
  readonly isRunning: boolean;
  /** None for a calendar entry with no levels. */
  readonly stages: readonly Stage[];
  readonly clock: ClockReading;
  readonly field: Omit<LiveField, 'chipsInPlay'>;
  readonly mine: MyStanding | null;
  readonly offer: AppPurchase | null;
}

interface TvRow {
  name: string; levels: unknown; elapsed_seconds: number; is_paused: boolean; entries: number; players_left: number; chips_in_play: number;
  pool_paise: number;
}

/** The first row as a live tournament, its clock read now; none when nothing runs. */
export function toLiveTournament(rows: readonly TvRow[], readAtMs: number): LiveTournament | null {
  const row = rows[0];
  if (row === undefined) return null;
  return {
    name: row.name, stages: blindLevelsSchema.parse(row.levels), clock: { elapsedSeconds: row.elapsed_seconds, isRunning: !row.is_paused, readAtMs },
    field: { entries: row.entries, playersLeft: row.players_left, chipsInPlay: row.chips_in_play, pool: fromPaise(BigInt(row.pool_paise)) },
  };
}

interface MyRow {
  id: string; name: string; starts_at: string; buy_in_paise: number; guarantee_paise: number | null; is_running: boolean; levels: unknown;
  elapsed_seconds: number; is_paused: boolean; entries: number; players_left: number; pool_paise: number; my_status: string | null;
  my_table: number | null; my_seat: number | null; offer: string | null;
}

const STANDINGS: readonly MyStanding['status'][] = ['seated', 'alternate', 'busted', 'refunded'];
const OFFERS: readonly AppPurchase[] = ['entry', 're_entry', 'rebuy'];

/** The member's tournament from its row, its clock read now. */
export function toMyTournament(row: MyRow, readAtMs: number): MyTournament {
  const status = STANDINGS.find((each) => each === row.my_status);
  return {
    id: row.id, name: row.name, startsAt: row.starts_at, buyIn: fromPaise(BigInt(row.buy_in_paise)),
    guarantee: row.guarantee_paise === null ? null : fromPaise(BigInt(row.guarantee_paise)), isRunning: row.is_running,
    stages: row.levels === null ? [] : blindLevelsSchema.parse(row.levels),
    clock: { elapsedSeconds: row.elapsed_seconds, isRunning: row.is_running && !row.is_paused, readAtMs },
    field: { entries: row.entries, playersLeft: row.players_left, pool: fromPaise(BigInt(row.pool_paise)) },
    mine: status === undefined ? null : { status, table: row.my_table, seat: row.my_seat },
    offer: OFFERS.find((each) => each === row.offer) ?? null,
  };
}

// Home and the TV tick on their own between reads; a read every half minute catches the floor's changes.
const LIVE_CHECK = 30_000;

/** Home's tournament for the member (feature tournaments.register): running or next, with their standing; null when none. */
export function useMyTournament() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myTournament(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: LIVE_CHECK,
    queryFn: async (): Promise<MyTournament | null> => {
      const { data, error } = await client.rpc('my_tournament');
      if (error) throw error;
      const row = data[0];
      return row === undefined ? null : toMyTournament(row, Date.now());
    },
  });
}

/** The member buys in from the app with their wallet cash (#118): a Result with the buy, and what they see reloads. */
export function useRegisterTournamentEntry() {
  const { client } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (order: { tournamentId: string; purchase: AppPurchase; requestId: string }): Promise<Result<string, BuyFailure>> => {
      const { data, error } = await client.rpc('register_tournament_entry', {
        p_tournament_id: order.tournamentId, p_purchase: order.purchase, p_idempotency_key: order.requestId,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.personal });
      return error ? err(toBuyFailure(error)) : ok(data);
    },
  });
}

/** The signed-in TV's tournament clock: the venue's running tournament, live while the TV's screen listens (useTvSignals). */
export function useTvTournamentClock() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tvTournamentClock(userId ?? 'signed-out'),
    enabled: userId !== null,
    refetchInterval: LIVE_CHECK,
    queryFn: async (): Promise<LiveTournament | null> => {
      const { data, error } = await client.rpc('tv_tournament_clock');
      if (error) throw error;
      return toLiveTournament(data, Date.now());
    },
  });
}

/**
 * A clock's elapsed seconds now, from the server's reading (`ClockReading`, decision 0201), read again every
 * second while it runs: the console, the TV and Home count down with it. Nothing read yet, or not started, is 0.
 */
export function useElapsedNow(reading: ClockReading | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  const isTicking = reading?.isRunning === true;
  useEffect(() => {
    if (!isTicking) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isTicking]);
  return reading ? elapsedNow(reading, now) : 0;
}

/** A satellite ticket the member holds (#519): the tournament it enters, when that starts, and its value. */
export interface MyTournamentTicket {
  readonly ticketId: string;
  readonly memberId: string;
  readonly tournamentId: string;
  readonly tournamentName: string;
  readonly startsAt: string;
  readonly value: Paise;
}

/** The tickets the member holds, the soonest first (tournaments.register). */
export function useMyTournamentTickets() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myTournamentTickets(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<MyTournamentTicket[]> => {
      const { data, error } = await client.rpc('my_tournament_tickets');
      if (error) throw error;
      return data.map((row) => ({
        ticketId: row.ticket_id, memberId: row.member_id, tournamentId: row.tournament_id, tournamentName: row.tournament_name,
        startsAt: row.starts_at, value: fromPaise(BigInt(row.value_paise)),
      }));
    },
  });
}

/** The member enters a tournament with their ticket (#519): a Result with the entry, and what they see reloads. */
export function useEnterWithTicket() {
  const { client } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (order: { ticket: MyTournamentTicket; requestId: string }): Promise<Result<string, BuyFailure>> => {
      const { data, error } = await client.rpc('use_tournament_ticket', {
        p_tournament_id: order.ticket.tournamentId, p_member_id: order.ticket.memberId, p_idempotency_key: order.requestId,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.personal });
      return error ? err(toBuyFailure(error)) : ok(data);
    },
  });
}
