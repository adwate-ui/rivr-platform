import { promotionVersionReplaySchema, type PromotionSimulationResult } from '@rivr/contracts/promotionModel';
import { clubDay } from '@rivr/domain/clubDay';
import { simulate, toPromotionEvent, type Terms } from '@rivr/domain/promotions';
import { useQuery } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** Last week replayed on a version: what it would have given, and the club days replayed. */
export interface SimulationRun extends PromotionSimulationResult {
  readonly from: Date;
  readonly to: Date;
}

/**
 * The terms as if the version had run on the days replayed (decision 0495): from the first of them, with no last day. A
 * promotion that starts today or later still shows what last week would have given; its days and times still count.
 */
function asIfRunning(terms: Terms, from: string): Terms {
  const { endsOn: _endsOn, ...schedule } = terms.schedule;
  return { ...terms, schedule: { ...schedule, startsOn: clubDay(new Date(from)) } };
}

/** `promotion_version_replay`'s answer weighed with @rivr/domain simulate, or null when it cannot be read. */
export function simulationOf(replay: unknown, terms: Terms): SimulationRun | null {
  const parsed = promotionVersionReplaySchema.safeParse(replay);
  if (!parsed.success) return null;
  const events = parsed.data.events.map(({ event, member }) => ({ event: toPromotionEvent(event), member }));
  const { grants: _grants, ...result } = simulate(asIfRunning(terms, parsed.data.from), events);
  return { ...result, from: new Date(parsed.data.from), to: new Date(parsed.data.to) };
}

/**
 * Last week replayed afresh on a version, for its approver (decision 0495): the database's events weighed here, never the
 * figures stored with the version, which its author's browser sent. It changes nothing.
 */
export function useLastWeekReplay(versionId: string, terms: Terms | null) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.promotionReplay(userId ?? 'signed-out', versionId),
    enabled: userId !== null && terms !== null,
    queryFn: async (): Promise<SimulationRun> => {
      const { data, error } = await client.rpc('promotion_version_replay', { p_version_id: versionId });
      if (error) throw error;
      const run = terms === null ? null : simulationOf(data, terms);
      if (run === null) throw new Error('Last week’s replay could not be read');
      return run;
    },
  });
}
