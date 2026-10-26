import { err, ok, type Result } from '@rivr/contracts/result';
import type { TournamentFormat } from '@rivr/contracts/tournaments';
import { fromPaise, type Paise } from '@rivr/domain/money';
import type { Stage } from '@rivr/domain/tournament';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';
import { toFormat, toStages, tournamentFailure, type TournamentAddOn, type TournamentFailure } from './tournaments.ts';

/** A venue's blind structure (#115, decision 0200): its name and its levels and breaks. */
export interface BlindStructure {
  readonly id: string;
  readonly name: string;
  readonly stages: readonly Stage[];
}

/** A tournament template (#115, #116): amounts in paise, chips and levels as whole numbers. */
export interface TournamentTemplate {
  readonly id: string;
  readonly name: string;
  readonly format: TournamentFormat;
  readonly buyIn: Paise;
  readonly fee: Paise;
  readonly startingStack: number;
  readonly structureId: string;
  readonly lastRegistrationLevel: number;
  readonly maxBuys: number | null;
  readonly addOn: TournamentAddOn | null;
  readonly placesPaid: number;
  readonly guarantee: Paise | null;
}

/** A template as the console saves it: a new one has no id. */
export type TemplateOrder = Omit<TournamentTemplate, 'id'> & { readonly templateId: string | null };

/** The venue's blind structures by name (tournaments.manage). */
export function useBlindStructures(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.blindStructures(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<BlindStructure[]> => {
      const { data, error } = await client.from('blind_structure').select('id, name, levels').eq('venue_id', venueId).order('name');
      if (error) throw error;
      return data.map((row) => ({ id: row.id, name: row.name, stages: toStages(row.levels) }));
    },
  });
}

/** The venue's tournament templates by name (tournaments.manage). */
export function useTournamentTemplates(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.tournamentTemplates(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<TournamentTemplate[]> => {
      const { data, error } = await client.from('tournament_template').select('*').eq('venue_id', venueId).order('name');
      if (error) throw error;
      return data.map((row) => ({
        id: row.id, name: row.name, format: toFormat(row.format), buyIn: fromPaise(BigInt(row.buy_in_paise)), fee: fromPaise(BigInt(row.fee_paise)),
        startingStack: row.starting_stack, structureId: row.blind_structure_id, lastRegistrationLevel: row.last_registration_level,
        maxBuys: row.max_buys, placesPaid: row.places_paid, guarantee: row.guarantee_paise === null ? null : fromPaise(BigInt(row.guarantee_paise)),
        addOn: row.add_on_paise === null || row.add_on_chips === null ? null
          : { price: fromPaise(BigInt(row.add_on_paise)), fee: fromPaise(BigInt(row.add_on_fee_paise ?? 0)), chips: row.add_on_chips },
      }));
    },
  });
}

/** Stages as the database keeps them (decision 0200). */
function toLevelsJson(stages: readonly Stage[]) {
  return stages.map((stage) => (stage.kind === 'break' ? { kind: stage.kind, minutes: stage.minutes }
    : { kind: stage.kind, small_blind: stage.smallBlind, big_blind: stage.bigBlind, ante: stage.ante, minutes: stage.minutes }));
}

/** A template's columns as the database's save takes them; paise as plain numbers, which hold them exactly. */
function toTemplateJson(order: TemplateOrder) {
  return {
    name: order.name.trim(), format: order.format, buy_in_paise: Number(order.buyIn), fee_paise: Number(order.fee), starting_stack: order.startingStack,
    blind_structure_id: order.structureId, last_registration_level: order.lastRegistrationLevel, max_buys: order.maxBuys,
    add_on_paise: order.addOn === null ? null : Number(order.addOn.price), add_on_fee_paise: order.addOn === null ? null : Number(order.addOn.fee),
    add_on_chips: order.addOn?.chips ?? null, places_paid: order.placesPaid, guarantee_paise: order.guarantee === null ? null : Number(order.guarantee),
  };
}

/** Adds or changes a blind structure and a template (tournaments.manage); each a Result with the id, and the lists reload. */
export function useTournamentSetupActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const person = userId ?? 'signed-out';
  const saveStructure = useMutation({
    mutationFn: async (order: { structureId: string | null; name: string; stages: readonly Stage[] }): Promise<Result<string, TournamentFailure>> => {
      const { data, error } = await client.rpc('save_blind_structure', {
        p_venue_id: venueId, p_name: order.name.trim(), p_levels: toLevelsJson(order.stages), ...(order.structureId === null ? {} : { p_structure_id: order.structureId }),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.blindStructures(person, venueId) });
      return error ? err(tournamentFailure(error.code)) : ok(data);
    },
  });
  const saveTemplate = useMutation({
    mutationFn: async (order: TemplateOrder): Promise<Result<string, TournamentFailure>> => {
      const { data, error } = await client.rpc('save_tournament_template', {
        p_venue_id: venueId, p_template: toTemplateJson(order), ...(order.templateId === null ? {} : { p_template_id: order.templateId }),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.tournamentTemplates(person, venueId) });
      return error ? err(tournamentFailure(error.code)) : ok(data);
    },
  });
  return { saveStructure, saveTemplate };
}
