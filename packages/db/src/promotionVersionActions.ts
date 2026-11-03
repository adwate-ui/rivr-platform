import type { PromotionTerms } from '@rivr/contracts/promotionModel';
import { err, ok, type Result } from '@rivr/contracts/result';
import { cardWords, type PromotionNames, type Terms } from '@rivr/domain/promotions';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RivrClient } from './client.ts';
import { simulationOf, type SimulationRun } from './promotionReplay.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/**
 * Why a version call did not go through: not allowed, terms the model refuses, no simulation on these terms, a super
 * admin approving their own, decided already, promotions switched off, the venue paused, no such promotion, no answer.
 */
export type PromotionVersionFailure =
  | 'not_allowed' | 'invalid' | 'needs_simulation' | 'own_promotion' | 'already_decided' | 'switched_off' | 'paused' | 'not_found' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, PromotionVersionFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', '23514': 'invalid', '23502': 'invalid', RVVER: 'invalid', RVSIM: 'needs_simulation',
  RVTWO: 'own_promotion', RVDEC: 'already_decided', RVKIL: 'switched_off', RVFRZ: 'paused', P0002: 'not_found',
};

/** A draft as the builder saves it: a new promotion's (no id) or the next version of one; the names its card words use. */
export interface DraftToSave {
  readonly promotionId: string | null;
  readonly terms: PromotionTerms;
  readonly names?: PromotionNames | undefined;
  /** One id a save, kept for a retry after a lost answer, so the retry returns the first draft. */
  readonly requestId: string;
}

/** A draft saved: its version, and the promotion it belongs to, new with a new promotion's first save. */
export interface SavedDraft {
  readonly versionId: string;
  readonly promotionId: string;
}

const termsOnly = (terms: Terms) => ({ reward: terms.reward, eligibility: terms.eligibility, schedule: terms.schedule, limits: terms.limits });

/** Settles a version call: reloads the list and the versions, then says how the call went. */
function useSettle(venueId: string) {
  const { userId } = useRivrData();
  const queryClient = useQueryClient();
  return async <T>(value: T, error: { code: string } | null): Promise<Result<T, PromotionVersionFailure>> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.promotionsOverview(userId ?? 'signed-out', venueId) });
    await queryClient.invalidateQueries({ queryKey: ['user', userId ?? 'signed-out', 'promotion-versions'] });
    return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(value);
  };
}

/**
 * Replays a draft on last week as if it had run then (decisions 0437 and 0465): the database's events, @rivr/domain
 * simulate, and the result stored on the version with the terms it ran on.
 */
function useSimulate(venueId: string) {
  const { client } = useRivrData();
  const settle = useSettle(venueId);
  return useMutation({
    mutationFn: async ({ versionId, terms }: { versionId: string; terms: Terms }): Promise<Result<SimulationRun, PromotionVersionFailure>> => {
      const { data, error } = await client.rpc('promotion_version_replay', { p_version_id: versionId });
      if (error) return err(FAILURE_BY_CODE[error.code] ?? 'unavailable');
      const run = simulationOf(data, terms);
      if (run === null) return err('unavailable');
      const { from: _from, to: _to, ...result } = run;
      const stored = await client.rpc('record_promotion_simulation', { p_version_id: versionId, p_simulation: result, p_terms: termsOnly(terms) });
      return settle(run, stored.error);
    },
  });
}

/** The promotion a version belongs to, or null when it cannot be read. */
async function promotionOf(client: RivrClient, versionId: string): Promise<string | null> {
  const { data, error } = await client.from('promotion_version').select('promotion_id').eq('id', versionId).limit(1);
  return error ? null : (data[0]?.promotion_id ?? null);
}

/**
 * Saves the builder's draft with its card words (cardWords): a new promotion, its open draft, or the next version of a
 * running one. A new promotion's id is read back, so its next save changes the same draft.
 */
function useSaveDraft(venueId: string) {
  const { client } = useRivrData();
  const settle = useSettle(venueId);
  return useMutation({
    mutationFn: async ({ promotionId, terms, names, requestId }: DraftToSave): Promise<Result<SavedDraft, PromotionVersionFailure>> => {
      const words = cardWords(terms, names);
      const saved = await client.rpc('save_promotion_draft', {
        p_venue_id: venueId, p_draft: { terms, detail: words.detail, runs: words.runs, request_id: requestId },
        ...(promotionId === null ? {} : { p_promotion_id: promotionId }),
      });
      if (saved.error) return settle({ versionId: '', promotionId: '' }, saved.error);
      const owner = promotionId ?? await promotionOf(client, saved.data);
      return settle({ versionId: saved.data, promotionId: owner ?? '' }, owner === null ? { code: 'unavailable' } : null);
    },
  });
}

/** One call on a version by its id. */
function useVersionCall(venueId: string, run: (client: RivrClient, versionId: string) => PromiseLike<{ error: { code: string } | null }>) {
  const { client } = useRivrData();
  const settle = useSettle(venueId);
  return useMutation({ mutationFn: async (versionId: string) => settle(null, (await run(client, versionId)).error) });
}

/**
 * The builder's and the approver's calls on versions (console v3 phase 7): save a draft, simulate it, submit it,
 * approve it or reject it with a reason, pause or resume it, end it. The list and the versions reload after each.
 */
export function usePromotionVersionActions(venueId: string) {
  const { client } = useRivrData();
  const settle = useSettle(venueId);
  const submit = useVersionCall(venueId, (db, id) => db.rpc('submit_promotion_version', { p_version_id: id }));
  const approve = useVersionCall(venueId, (db, id) => db.rpc('approve_promotion_version', { p_version_id: id }));
  const end = useVersionCall(venueId, (db, id) => db.rpc('end_promotion_version', { p_version_id: id }));
  const reject = useMutation({
    mutationFn: async ({ versionId, reason }: { versionId: string; reason: string }) =>
      settle(null, (await client.rpc('reject_promotion_version', { p_version_id: versionId, p_reason: reason })).error),
  });
  const setLive = useMutation({
    mutationFn: async ({ versionId, isLive }: { versionId: string; isLive: boolean }) =>
      settle(null, (await client.rpc('set_promotion_version_live', { p_version_id: versionId, p_is_live: isLive })).error),
  });
  return { saveDraft: useSaveDraft(venueId), simulate: useSimulate(venueId), submit, approve, reject, setLive, end };
}
