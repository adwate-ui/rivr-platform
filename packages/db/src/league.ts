import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A RIVR League season (#147, decision 0182): its first and last months, each as its first day (`2026-11-01`). */
export interface LeagueSeason {
  readonly id: string;
  readonly name: string;
  readonly firstMonth: string;
  readonly lastMonth: string;
}

/** A season as the console saves it: a new one has no id; months as `2026-11`. */
export interface LeagueSeasonOrder {
  readonly seasonId: string | null;
  readonly name: string;
  readonly firstMonth: string;
  readonly lastMonth: string;
}

/** One member's place over some League months on the console: cash and tournament points apart; ties share a place. */
export interface LeagueStanding {
  readonly place: number;
  readonly memberId: string;
  readonly fullName: string;
  readonly memberNumber: number;
  readonly cashPoints: bigint;
  readonly tournamentPoints: bigint;
  readonly points: bigint;
}

/**
 * A place on the League's board as members and the TVs see it (decision 0182): this month's (`month`) or
 * the season's (`season`, with its name), a first name and initial or none for a member who hid it, and
 * whether it is the signed-in member's own.
 */
export interface LeagueBoardRow {
  readonly standing: 'month' | 'season';
  readonly seasonName: string | null;
  readonly firstMonth: string;
  readonly lastMonth: string;
  readonly place: number;
  readonly name: string | null;
  readonly points: bigint;
  readonly isMe: boolean;
}

/** Why a season was not saved: the role does not allow it, a name or months out of bounds or overlapping another season, the venue frozen, or anything else. */
export type LeagueFailure = 'not_allowed' | 'invalid' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, LeagueFailure>> = { '42501': 'not_allowed', '22023': 'invalid', RVFRZ: 'paused' };

/** `2026-11` as the month's first day, as the database keeps League months. */
const firstDay = (month: string) => `${month.slice(0, 7)}-01`;

/** A venue's League seasons, the latest first (members.read or rewards.manage). */
export function useLeagueSeasons(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.leagueSeasons(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<LeagueSeason[]> => {
      const { data, error } = await client.from('league_season').select('id, name, first_month, last_month')
        .eq('venue_id', venueId).order('first_month', { ascending: false });
      if (error) throw error;
      return data.map((row) => ({ id: row.id, name: row.name, firstMonth: row.first_month, lastMonth: row.last_month }));
    },
  });
}

/** Adds a season or changes one (rewards.manage); a Result with its id, and the seasons reload. */
export function useSaveLeagueSeason(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (order: LeagueSeasonOrder): Promise<Result<string, LeagueFailure>> => {
      const { data, error } = await client.rpc('save_league_season', {
        p_venue_id: venueId, p_name: order.name.trim(), p_first_month: firstDay(order.firstMonth), p_last_month: firstDay(order.lastMonth),
        ...(order.seasonId === null ? {} : { p_season_id: order.seasonId }),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.leagueSeasons(userId ?? 'signed-out', venueId) });
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(data);
    },
  });
}

/** The standings over the League months from `firstMonth` to `lastMonth` (`2026-11`), for staff who read members or keep rewards. */
export function useVenueLeague(venueId: string, firstMonth: string, lastMonth: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.venueLeague(userId ?? 'signed-out', venueId, firstDay(firstMonth), firstDay(lastMonth)),
    enabled: userId !== null,
    queryFn: async (): Promise<LeagueStanding[]> => {
      const { data, error } = await client.rpc('venue_league', { p_venue_id: venueId, p_first: firstDay(firstMonth), p_last: firstDay(lastMonth) });
      if (error) throw error;
      return data.map((row) => ({
        place: row.place, memberId: row.member_id, fullName: row.full_name, memberNumber: row.member_number,
        cashPoints: BigInt(row.cash_points), tournamentPoints: BigInt(row.tournament_points), points: BigInt(row.points),
      }));
    },
  });
}
