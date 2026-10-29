import { promotionReplaySchema, promotionRulesSchema, type PromotionRules } from '@rivr/contracts/promotions';
import { err, ok, type Result } from '@rivr/contracts/result';
import { fromPaise, type Paise } from '@rivr/domain/money';
import { simulatePromotion, type PromotionDraft, type PromotionSimulation } from '@rivr/domain/promotions';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A promotion on the console's list (#84): its card's words and whether it is live or paused. */
export interface ConsolePromotion {
  readonly id: string;
  readonly name: string;
  /** What it gives, as published; null when its name says it. */
  readonly detail: string | null;
  /** Who and when, as published: "100/200 · Thursday, 14:00 to 20:00". */
  readonly runs: string | null;
  readonly isLive: boolean;
}

/** A stake the builder's Who block offers: a table type's code and name ("NLH 100/200", "Private Room"). */
export interface PromotionStake {
  readonly code: string;
  readonly name: string;
}

/** A promotion as the builder submits it: its name and card's words, and its rule. */
export interface PromotionToSubmit {
  readonly name: string;
  readonly runs: string;
  /** What it gives, when the name does not say it all: "Up to ₹5,000 a buy-in". */
  readonly detail?: string | undefined;
  readonly draft: PromotionDraft;
  /** Its rules and its questions with their answers, as the website shows them (#618). */
  readonly rules?: readonly string[] | undefined;
  readonly questions?: readonly { readonly question: string; readonly answer: string }[] | undefined;
}

/** A template sent for approval as it stands (#85), with a budget for the whole promotion or each month, or none (#562). */
export interface TemplateSubmission {
  readonly id: string;
  readonly budget: { readonly paise: Paise; readonly period: 'promotion' | 'month' } | null;
}

/** Why a submission, approval, refusal, pause or resume did not go through; own_promotion: a super admin approving what they submitted. */
export type PromotionFailure = 'not_allowed' | 'invalid' | 'own_promotion' | 'already_decided' | 'switched_off' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, PromotionFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', '23514': 'invalid', RVTWO: 'own_promotion', RVDEC: 'already_decided', RVKIL: 'switched_off', RVFRZ: 'paused',
};

/** A promotion waiting for a super admin (#144): who submitted it, when, and whether the signed-in staff member did. */
export interface PromotionAwaitingApproval {
  readonly id: string;
  readonly name: string;
  readonly detail: string | null;
  readonly runs: string | null;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly isMine: boolean;
  /** What it does, as stored: the approver reads these, not only the card words typed. Null when they cannot be read. */
  readonly rules: PromotionRules | null;
  readonly perPlayer: { readonly limit: number; readonly period: string } | null;
  /** Its budget, in paise and in grants; null for either when there is none; for the whole promotion or each month (#562). */
  readonly budget: { readonly paise: bigint | null; readonly count: number | null; readonly period: 'promotion' | 'month' };
}

/** A promotion a super admin sent back in the last fortnight (#144), with who did and why. */
export interface PromotionSentBack {
  readonly id: string;
  readonly name: string;
  readonly detail: string | null;
  readonly runs: string | null;
  readonly isTemplate: boolean;
  readonly refusedBy: string;
  readonly refusedAt: string;
  readonly reason: string;
}

/** The venue's promotions waiting for a super admin, oldest first, for staff who manage promotions. */
export function usePromotionsAwaitingApproval(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.promotionsAwaitingApproval(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<PromotionAwaitingApproval[]> => {
      const { data, error } = await client.rpc('promotions_awaiting_approval', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => {
        const rules = promotionRulesSchema.safeParse(row.rules);
        return {
          id: row.promotion_id, name: row.name, detail: row.detail, runs: row.runs, requestedBy: row.requested_by, requestedAt: row.requested_at,
          isMine: row.is_mine, rules: rules.success ? rules.data : null,
          perPlayer: row.per_player_limit === null || row.per_player_period === null ? null : { limit: row.per_player_limit, period: row.per_player_period },
          budget: { paise: row.budget_paise === null ? null : BigInt(row.budget_paise), count: row.budget_count,
            period: row.budget_period === 'month' ? 'month' : 'promotion' },
        };
      });
    },
  });
}

/** The venue's live and paused promotions, newest first, for staff who manage promotions. */
export function usePromotions(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.promotions(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<ConsolePromotion[]> => {
      const { data, error } = await client.from('promotion').select('id, name, detail, runs, status').eq('venue_id', venueId)
        .in('status', ['live', 'paused']).order('created_at', { ascending: false });
      if (error) throw error;
      return data.map((row) => ({ id: row.id, name: row.name, detail: row.detail, runs: row.runs, isLive: row.status === 'live' }));
    },
  });
}

/** The venue's draft templates, every scheme in the deck not yet published (#85), by name. */
export function usePromotionTemplates(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.promotionTemplates(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<ConsolePromotion[]> => {
      const { data, error } = await client.from('promotion').select('id, name, detail, runs').eq('venue_id', venueId).eq('status', 'draft')
        .not('template_key', 'is', null).order('name');
      if (error) throw error;
      return data.map((row) => ({ id: row.id, name: row.name, detail: row.detail, runs: row.runs, isLive: false }));
    },
  });
}

/** The venue's table types, lowest blinds first, for the builder's Who block. */
export function usePromotionStakes(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.promotionStakes(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<PromotionStake[]> => {
      const { data, error } = await client.from('table_type').select('code, name').eq('venue_id', venueId)
        .order('small_blind_paise').order('name');
      if (error) throw error;
      return data.map((row) => ({ code: row.code, name: row.name }));
    },
  });
}

/** A promotion replayed on last week (#144): what it would have given, and the club days replayed. */
export interface PromotionSimulationResult extends PromotionSimulation {
  readonly from: Date;
  readonly to: Date;
}

/** Why a simulation did not run: not a promotion manager, a rule last week cannot replay, or no answer. */
export type SimulationFailure = 'not_allowed' | 'not_replayable' | 'unavailable';

const SIMULATION_FAILURE_BY_CODE: Readonly<Record<string, SimulationFailure>> = { '42501': 'not_allowed', '22023': 'not_replayable' };

/**
 * Replays a promotion on last week's events before it is published (#144; decision 0214): the database
 * gives the seven whole club days' buy-ins or hours played (`promotion_replay`), and @rivr/domain
 * simulatePromotion weighs them with the engine's own rules. The builder's promotions have no budget.
 */
export function usePromotionSimulation(venueId: string) {
  const { client } = useRivrData();
  return useMutation({
    mutationFn: async (draft: PromotionDraft): Promise<Result<PromotionSimulationResult, SimulationFailure>> => {
      const { data, error } = await client.rpc('promotion_replay', { p_venue_id: venueId, p_trigger: draft.rule.trigger, p_conditions: draft.rule.conditions });
      if (error) return err(SIMULATION_FAILURE_BY_CODE[error.code] ?? 'unavailable');
      const replay = promotionReplaySchema.safeParse(data);
      if (!replay.success) return err('unavailable');
      const events = replay.data.events.map((event) => ({
        at: new Date(event.at), memberId: String(event.member), tierId: event.tier_id, tableId: event.table_id, stake: event.stake,
        amount: fromPaise(BigInt(event.amount_paise)), points: BigInt(event.points), hoursPlayed: event.hours_played,
      }));
      const simulation = simulatePromotion(draft, events);
      return simulation.ok ? ok({ ...simulation.value, from: new Date(replay.data.from), to: new Date(replay.data.to) }) : err(simulation.error);
    },
  });
}

/** The venue's promotions sent back in the last fortnight, newest first, with who sent each back and why (#144). */
export function usePromotionsSentBack(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.promotionsSentBack(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<PromotionSentBack[]> => {
      const { data, error } = await client.rpc('promotions_sent_back', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        id: row.promotion_id, name: row.name, detail: row.detail, runs: row.runs, isTemplate: row.template_key !== null,
        refusedBy: row.refused_by, refusedAt: row.refused_at, reason: row.refused_reason,
      }));
    },
  });
}

/** Settles a promotion call: reloads the venue's promotion lists, then says how the call went. */
function useSettle(venueId: string) {
  const { userId } = useRivrData();
  const queryClient = useQueryClient();
  return async <T>(value: T, error: { code: string } | null): Promise<Result<T, PromotionFailure>> => {
    for (const key of [queryKeys.promotions, queryKeys.promotionTemplates, queryKeys.promotionsAwaitingApproval, queryKeys.promotionsSentBack]) {
      await queryClient.invalidateQueries({ queryKey: key(userId ?? 'signed-out', venueId) });
    }
    return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(value);
  };
}

/**
 * Submits a promotion from the builder or a template for a super admin (#144), and pauses or resumes a live one; the
 * lists reload after each.
 */
export function usePromotionActions(venueId: string) {
  const { client } = useRivrData();
  const settle = useSettle(venueId);
  const submit = useMutation({
    mutationFn: async ({ name, detail, runs, draft, rules = [], questions = [] }: PromotionToSubmit) => {
      const perPlayer = draft.perPlayer === null ? {} : { per_player_limit: draft.perPlayer.limit, per_player_period: draft.perPlayer.period };
      const promotion = { name, detail, runs, rule: draft.rule, rules: [...rules], questions: questions.map((item) => ({ ...item })), ...perPlayer };
      const { data, error } = await client.rpc('submit_promotion', { p_venue_id: venueId, p_promotion: promotion });
      return settle(data, error);
    },
  });
  const setLive = useMutation({
    mutationFn: async ({ id, isLive }: { id: string; isLive: boolean }) => {
      const { error } = await client.rpc('set_promotion_live', { p_promotion_id: id, p_is_live: isLive });
      return settle(null, error);
    },
  });
  const submitTemplate = useMutation({
    mutationFn: async ({ id, budget }: TemplateSubmission) => {
      const { error } = await client.rpc('submit_promotion_template', budget === null ? { p_promotion_id: id }
        : { p_promotion_id: id, p_budget_paise: Number(budget.paise), p_budget_period: budget.period });
      return settle(null, error);
    },
  });
  return { submit, setLive, submitTemplate };
}

/** A super admin approves a waiting promotion, never their own, or refuses it with a reason (#144); the lists reload. */
export function usePromotionDecisions(venueId: string) {
  const { client } = useRivrData();
  const settle = useSettle(venueId);
  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.rpc('approve_promotion', { p_promotion_id: id });
      return settle(null, error);
    },
  });
  const refuse = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await client.rpc('refuse_promotion', { p_promotion_id: id, p_reason: reason });
      return settle(null, error);
    },
  });
  return { approve, refuse };
}
