import { err, ok, type Result } from '@rivr/contracts/result';
import type { PromotionDraft } from '@rivr/domain/promotions';
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

/** A promotion as the builder publishes it: its name and card's words, and its rule. */
export interface PromotionToPublish {
  readonly name: string;
  readonly runs: string;
  readonly draft: PromotionDraft;
}

/** Why a publish, pause or resume did not go through. */
export type PromotionFailure = 'not_allowed' | 'invalid' | 'switched_off' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, PromotionFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', '23514': 'invalid', RVKIL: 'switched_off', RVFRZ: 'paused',
};

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

/** Publishes a promotion live from the builder, and pauses or resumes one; the list reloads after each. */
export function usePromotionActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async <T>(value: T, error: { code: string } | null): Promise<Result<T, PromotionFailure>> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.promotions(userId ?? 'signed-out', venueId) });
    return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(value);
  };
  const publish = useMutation({
    mutationFn: async ({ name, runs, draft }: PromotionToPublish) => {
      const perPlayer = draft.perPlayer === null ? {} : { per_player_limit: draft.perPlayer.limit, per_player_period: draft.perPlayer.period };
      const { data, error } = await client.rpc('publish_promotion', { p_venue_id: venueId, p_promotion: { name, runs, rule: draft.rule, ...perPlayer } });
      return settle(data, error);
    },
  });
  const setLive = useMutation({
    mutationFn: async ({ id, isLive }: { id: string; isLive: boolean }) => {
      const { error } = await client.rpc('set_promotion_live', { p_promotion_id: id, p_is_live: isLive });
      return settle(null, error);
    },
  });
  return { publish, setLive };
}
