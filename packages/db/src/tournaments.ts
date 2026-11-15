import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** Where a member stands on an upcoming tournament (#636; redesign RD-26): not asked, or asked to be told. */
export type TournamentStanding = 'none' | 'interested';

/** An upcoming tournament at the member's venue: its name and start, and whether they asked to be told. */
export interface UpcomingTournament {
  readonly tournamentId: string;
  readonly name: string;
  readonly startsAt: string;
  readonly standing: TournamentStanding;
}

/**
 * Why a step on a tournament did not go through. `nobody`: Notify found no one who asked with tournament notifications on,
 * and the one send is kept. `too_often`: members were told of it three times in the last hour.
 */
export type TournamentFailure = 'not_allowed' | 'invalid' | 'paused' | 'too_often' | 'nobody' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, TournamentFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', RVFRZ: 'paused', RVMBR: 'not_allowed', RVRAT: 'too_often', RVNOB: 'nobody',
};

const failureOf = (error: { code: string }): TournamentFailure => FAILURE_BY_CODE[error.code] ?? 'unavailable';

/** The signed-in member's venue's upcoming tournaments, soonest first; none without tournaments.register in their tier. */
export function useMyUpcomingTournaments() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myUpcomingTournaments(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<UpcomingTournament[]> => {
      const { data, error } = await client.rpc('my_upcoming_tournaments');
      if (error) throw error;
      return data.map((row) => ({
        tournamentId: row.tournament_id, name: row.name, startsAt: row.starts_at, standing: row.standing === 'interested' ? 'interested' : 'none',
      }));
    },
  });
}

/** The member asks to be told of an upcoming tournament, once: a Result, and the list reloads. */
export function useRegisterTournamentInterest() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tournamentId: string): Promise<Result<null, TournamentFailure>> => {
      const { error } = await client.rpc('register_tournament_interest', { p_tournament_id: tournamentId });
      await queryClient.invalidateQueries({ queryKey: queryKeys.myUpcomingTournaments(userId ?? 'signed-out') });
      return error ? err(failureOf(error)) : ok(null);
    },
  });
}

/** A tournament as the console creates it (redesign RD-26): its name, start and game. No money. */
export interface NewTournament {
  readonly name: string;
  readonly startsAt: Date;
  readonly game: string;
}

/** A tournament as staff see it: how many asked, when the notification went and to how many, and the entries typed once it has started. */
export interface VenueTournament {
  readonly tournamentId: string;
  readonly name: string;
  readonly startsAt: string;
  /** Empty for one made before a game was asked for. */
  readonly game: string;
  /** It has started: it is on the Past list, takes its entries and is notified no more. */
  readonly isPast: boolean;
  readonly interested: number;
  /** Null until Notify is sent. */
  readonly notifiedAt: string | null;
  readonly notified: number | null;
  /** Null until staff type them. */
  readonly entries: number | null;
}

/** A `venue_tournaments` row as the database gives it: the generated types call every column non-null, and these are not. */
interface VenueTournamentRow {
  tournament_id: string;
  name: string;
  starts_at: string;
  game: string | null;
  is_past: boolean;
  interested: number;
  notified_at: string | null;
  notified: number | null;
  entries: number | null;
}

/** One row of `venue_tournaments` as the console reads it. */
export function toVenueTournament(row: VenueTournamentRow): VenueTournament {
  return {
    tournamentId: row.tournament_id, name: row.name, startsAt: row.starts_at, game: row.game ?? '', isPast: row.is_past, interested: row.interested,
    notifiedAt: row.notified_at, notified: row.notified, entries: row.entries,
  };
}

/** The venue's tournaments (tournaments.manage), soonest first: every one to come and the latest that have started; asked again every half minute. */
export function useVenueTournaments(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.venueTournaments(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: 30_000,
    queryFn: async (): Promise<VenueTournament[]> => {
      const { data, error } = await client.rpc('venue_tournaments', { p_venue_id: venueId });
      if (error) throw error;
      return data.map(toVenueTournament);
    },
  });
}

/** A member who asked to be told of a tournament. */
export interface InterestedMember {
  readonly memberId: string;
  readonly fullName: string;
  readonly memberNumber: number;
  readonly askedAt: string;
}

/** Who asked to be told of one tournament (tournaments.manage), the latest first. */
export function useTournamentInterested(tournamentId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tournamentInterested(userId ?? 'signed-out', tournamentId),
    enabled: userId !== null,
    queryFn: async (): Promise<InterestedMember[]> => {
      const { data, error } = await client.rpc('tournament_interested', { p_tournament_id: tournamentId });
      if (error) throw error;
      return data.map((row) => ({ memberId: row.member_id, fullName: row.full_name, memberNumber: row.member_number, askedAt: row.asked_at }));
    },
  });
}

/**
 * What staff do with a tournament (tournaments.manage; redesign RD-26): create one, send its notification once (the Result
 * holds how many were told), cancel one still to come, and type a started one's entries. Each a Result, and the list reloads.
 */
export function useTournamentActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const reload = () => queryClient.invalidateQueries({ queryKey: queryKeys.venueTournaments(userId ?? 'signed-out', venueId) });
  const create = useMutation({
    mutationFn: async (tournament: NewTournament): Promise<Result<string, TournamentFailure>> => {
      const { data, error } = await client.rpc('publish_tournament', {
        p_venue_id: venueId, p_name: tournament.name.trim(), p_starts_at: tournament.startsAt.toISOString(), p_game: tournament.game.trim(),
      });
      await reload();
      return error ? err(failureOf(error)) : ok(data);
    },
  });
  const notify = useMutation({
    mutationFn: async (tournamentId: string): Promise<Result<number, TournamentFailure>> => {
      const { data, error } = await client.rpc('notify_tournament', { p_tournament_id: tournamentId });
      await reload();
      return error ? err(failureOf(error)) : ok(data);
    },
  });
  const cancel = useMutation({
    mutationFn: async (tournamentId: string): Promise<Result<null, TournamentFailure>> => {
      const { error } = await client.rpc('withdraw_tournament', { p_tournament_id: tournamentId });
      await reload();
      return error ? err(failureOf(error)) : ok(null);
    },
  });
  const setEntries = useMutation({
    mutationFn: async ({ tournamentId, entries }: { tournamentId: string; entries: number }): Promise<Result<null, TournamentFailure>> => {
      const { error } = await client.rpc('set_tournament_entries', { p_tournament_id: tournamentId, p_entries: entries });
      await reload();
      return error ? err(failureOf(error)) : ok(null);
    },
  });
  return { create, notify, cancel, setEntries };
}
