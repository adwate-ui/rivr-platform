import { err, ok, type Result } from '@rivr/contracts/result';
import { blindLevelsSchema } from '@rivr/contracts/blindLevels';
import { TOURNAMENT_FORMATS, type TournamentFormat } from '@rivr/contracts/tournaments';
import { fromPaise, type Paise } from '@rivr/domain/money';
import type { ClockReading, Stage } from '@rivr/domain/tournament';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Json } from './database.types.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';
import { tournamentFailure, type TournamentFailure } from './tournamentFailures.ts';

export { tournamentFailure, type TournamentFailure } from './tournamentFailures.ts';

/** An add-on as a tournament sells it: its price and the fee in it, in paise, and its chips. */
export interface TournamentAddOn {
  readonly price: Paise;
  readonly fee: Paise;
  readonly chips: number;
}

/** A tournament's field (#118): entries and re-entries, the players still seated, the chips bought and the prize pool. */
export interface TournamentField {
  readonly entries: number;
  readonly reEntries: number;
  readonly playersLeft: number;
  readonly chipsInPlay: number;
  readonly pool: Paise;
}

/** A tournament on the console (#115, #119): what its template set, its levels, its room, its field, and its clock when started. */
export interface VenueTournament {
  readonly id: string;
  readonly name: string;
  readonly startsAt: string;
  readonly isPublished: boolean;
  readonly format: TournamentFormat;
  readonly buyIn: Paise;
  readonly fee: Paise;
  readonly guarantee: Paise | null;
  readonly startingStack: number | null;
  /** None for a calendar entry made before templates; its clock cannot start. */
  readonly stages: readonly Stage[];
  readonly lastRegistrationLevel: number;
  readonly maxBuys: number | null;
  readonly addOn: TournamentAddOn | null;
  readonly placesPaid: number | null;
  /** Null until the clock starts. */
  readonly clock: ClockReading | null;
  readonly tables: number;
  readonly seatsPerTable: number;
  readonly field: TournamentField;
}

/** A change to a tournament's clock (decision 0201). */
export type ClockChange = 'start' | 'pause' | 'resume' | 'next' | 'previous';

/** A tournament's levels from the database: none when it has none. */
export function toStages(levels: Json | null): Stage[] {
  return levels === null ? [] : blindLevelsSchema.parse(levels);
}

/** The format as the database names it. */
export function toFormat(format: string): TournamentFormat {
  return TOURNAMENT_FORMATS.find((each) => each === format) ?? 'freezeout';
}

interface TournamentRow {
  id: string; name: string; starts_at: string; is_published: boolean; format: string; buy_in_paise: number; fee_paise: number;
  guarantee_paise: number | null; starting_stack: number | null; levels: Json | null; last_registration_level: number; max_buys: number | null;
  add_on_paise: number | null; add_on_fee_paise: number | null; add_on_chips: number | null; places_paid: number | null;
  clock_started_at: string | null; is_paused: boolean; elapsed_seconds: number; tables: number; seats_per_table: number; entries: number;
  re_entries: number; players_left: number; chips_in_play: number; pool_paise: number;
}

/** A field as the database reads it. */
export function toField(row: { entries: number; re_entries?: number; players_left: number; chips_in_play: number; pool_paise: number }): TournamentField {
  return {
    entries: row.entries, reEntries: row.re_entries ?? 0, playersLeft: row.players_left, chipsInPlay: row.chips_in_play,
    pool: fromPaise(BigInt(row.pool_paise)),
  };
}

function toAddOn(row: TournamentRow): TournamentAddOn | null {
  if (row.add_on_paise === null || row.add_on_chips === null) return null;
  return { price: fromPaise(BigInt(row.add_on_paise)), fee: fromPaise(BigInt(row.add_on_fee_paise ?? 0)), chips: row.add_on_chips };
}

function toTournament(row: TournamentRow, readAtMs: number): VenueTournament {
  return {
    id: row.id, name: row.name, startsAt: row.starts_at, isPublished: row.is_published, format: toFormat(row.format),
    buyIn: fromPaise(BigInt(row.buy_in_paise)), fee: fromPaise(BigInt(row.fee_paise)),
    guarantee: row.guarantee_paise === null ? null : fromPaise(BigInt(row.guarantee_paise)),
    startingStack: row.starting_stack, stages: toStages(row.levels), lastRegistrationLevel: row.last_registration_level, maxBuys: row.max_buys,
    addOn: toAddOn(row), placesPaid: row.places_paid,
    clock: row.clock_started_at === null ? null : { elapsedSeconds: row.elapsed_seconds, isRunning: !row.is_paused, readAtMs },
    tables: row.tables, seatsPerTable: row.seats_per_table, field: toField(row),
  };
}

// Another console's change shows within half a minute; this console's at once.
const TOURNAMENTS_CHECK = 30_000;

/** The venue's tournaments from twelve hours ago on and any running, the running first (tournaments.manage). */
export function useVenueTournaments(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.venueTournaments(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: TOURNAMENTS_CHECK,
    queryFn: async (): Promise<VenueTournament[]> => {
      const { data, error } = await client.rpc('venue_tournaments', { p_venue_id: venueId });
      if (error) throw error;
      const readAtMs = Date.now();
      return data.map((row) => toTournament(row, readAtMs));
    },
  });
}

/** Starts, pauses, resumes or moves a tournament's clock a level (tournaments.manage); a Result, and the tournaments reload. */
export function useTournamentClock(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tournamentId, change }: { tournamentId: string; change: ClockChange }): Promise<Result<null, TournamentFailure>> => {
      const id = { p_tournament_id: tournamentId };
      const { error } = change === 'start' ? await client.rpc('start_tournament_clock', id)
        : change === 'pause' || change === 'resume' ? await client.rpc('pause_tournament_clock', { ...id, p_is_paused: change === 'pause' })
        : await client.rpc('move_tournament_level', { ...id, p_step: change === 'next' ? 1 : -1 });
      await queryClient.invalidateQueries({ queryKey: queryKeys.venueTournaments(userId ?? 'signed-out', venueId) });
      return error ? err(tournamentFailure(error.code)) : ok(null);
    },
  });
}

/** A new tournament from a template: its name, its start, and whether the calendar and the app show it. */
export interface NewTournament {
  readonly templateId: string;
  readonly name: string;
  readonly startsAt: Date;
  readonly isPublished: boolean;
}

/** Makes a tournament from a template, or removes one made by mistake (tournaments.manage); a Result, and the tournaments reload. */
export function useTournamentActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const reload = () => queryClient.invalidateQueries({ queryKey: queryKeys.venueTournaments(userId ?? 'signed-out', venueId) });
  const create = useMutation({
    mutationFn: async (order: NewTournament): Promise<Result<string, TournamentFailure>> => {
      const { data, error } = await client.rpc('create_tournament', {
        p_template_id: order.templateId, p_name: order.name.trim(), p_starts_at: order.startsAt.toISOString(), p_is_published: order.isPublished,
      });
      await reload();
      return error ? err(tournamentFailure(error.code)) : ok(data);
    },
  });
  const list = useMutation({
    mutationFn: async (order: { tournament: VenueTournament; isPublished: boolean }): Promise<Result<null, TournamentFailure>> => {
      const { error } = await client.rpc('set_tournament_listing', {
        p_tournament_id: order.tournament.id, p_name: order.tournament.name, p_starts_at: order.tournament.startsAt, p_is_published: order.isPublished,
      });
      await reload();
      return error ? err(tournamentFailure(error.code)) : ok(null);
    },
  });
  const remove = useMutation({
    mutationFn: async (tournamentId: string): Promise<Result<null, TournamentFailure>> => {
      const { error } = await client.rpc('remove_tournament', { p_tournament_id: tournamentId });
      await reload();
      return error ? err(tournamentFailure(error.code)) : ok(null);
    },
  });
  return { create, list, remove };
}
