import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** Where a member stands on an upcoming tournament (#636): no interest yet, interested, or registered by the floor. */
export type TournamentStanding = 'none' | 'interested' | 'registered';

/** An upcoming tournament at the member's venue: its name and start, and their standing. No buy-in: the app shows no rupee. */
export interface UpcomingTournament {
  readonly tournamentId: string;
  readonly name: string;
  readonly startsAt: string;
  readonly standing: TournamentStanding;
}

/** One member's interest, as the floor's list has it: the tournament, who, when they asked, and whether registered. */
export interface TournamentInterest {
  readonly interestId: string;
  readonly tournamentId: string;
  readonly tournamentName: string;
  readonly startsAt: string;
  readonly memberId: string;
  readonly fullName: string;
  readonly memberNumber: number;
  readonly askedAt: string;
  readonly registeredAt: string | null;
}

/** Why registering interest or marking someone registered did not go through. */
export type TournamentInterestFailure = 'not_allowed' | 'invalid' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, TournamentInterestFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', RVFRZ: 'paused', RVMBR: 'not_allowed',
};

const STANDINGS: readonly TournamentStanding[] = ['none', 'interested', 'registered'];

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
        tournamentId: row.tournament_id, name: row.name, startsAt: row.starts_at,
        standing: STANDINGS.find((standing) => standing === row.standing) ?? 'none',
      }));
    },
  });
}

/** The member registers interest in an upcoming tournament, once: a Result, and the list reloads. */
export function useRegisterTournamentInterest() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tournamentId: string): Promise<Result<null, TournamentInterestFailure>> => {
      const { error } = await client.rpc('register_tournament_interest', { p_tournament_id: tournamentId });
      await queryClient.invalidateQueries({ queryKey: queryKeys.myUpcomingTournaments(userId ?? 'signed-out') });
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
}

/** The floor's list of who registered interest (waitlist.manage), soonest tournament first, asked again every half minute. */
export function useTournamentInterest(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tournamentInterest(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: 30_000,
    queryFn: async (): Promise<TournamentInterest[]> => {
      const { data, error } = await client.rpc('tournament_interest_list', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        interestId: row.interest_id, tournamentId: row.tournament_id, tournamentName: row.tournament_name, startsAt: row.starts_at,
        memberId: row.member_id, fullName: row.full_name, memberNumber: row.member_number, askedAt: row.created_at, registeredAt: row.registered_at,
      }));
    },
  });
}

/** A tournament to publish without money (#800; decision 0441): its name, start, the game and stake as text, and a description. */
export interface TournamentListing {
  readonly name: string;
  readonly startsAt: Date;
  readonly game: string;
  readonly stake: string;
  /** Empty for none. */
  readonly description: string;
}

/** Publishes an upcoming tournament without money (tournaments.manage): a Result with its id; members see it at once. */
export function usePublishTournament(venueId: string) {
  const { client } = useRivrData();
  return useMutation({
    mutationFn: async (listing: TournamentListing): Promise<Result<string, TournamentInterestFailure>> => {
      const { data, error } = await client.rpc('publish_tournament', {
        p_venue_id: venueId, p_name: listing.name.trim(), p_starts_at: listing.startsAt.toISOString(), p_game: listing.game.trim(),
        p_stake: listing.stake.trim(), p_description: listing.description.trim(),
      });
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(data);
    },
  });
}

/** The floor marks a member registered once they paid at the venue: a Result, and the list reloads. */
export function useMarkTournamentRegistered(venueId: string) {
  return useRegistrationChange(venueId, 'mark_tournament_registered');
}

/**
 * Undo for Mark registered (console v3): takes back a registration marked in the last ten minutes, refused as `invalid`
 * after that. A Result, and the list reloads.
 */
export function useUnmarkTournamentRegistered(venueId: string) {
  return useRegistrationChange(venueId, 'unmark_tournament_registered');
}

function useRegistrationChange(venueId: string, rpc: 'mark_tournament_registered' | 'unmark_tournament_registered') {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (interestId: string): Promise<Result<null, TournamentInterestFailure>> => {
      const { error } = await client.rpc(rpc, { p_interest_id: interestId });
      await queryClient.invalidateQueries({ queryKey: queryKeys.tournamentInterest(userId ?? 'signed-out', venueId) });
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
}
