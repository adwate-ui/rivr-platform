import { HOST_CHURN_REASONS, promotionEffectSchema, type HostChurnReason, type HostContact, type PromotionEffect } from '@rivr/contracts';
import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Json } from './database.types.ts';
import { useRivrData } from './provider.tsx';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/hostQueue).
const queueKey = (userId: string, venueId: string) => ['user', userId, 'host-queue', venueId] as const;

/** A lapsed regular in the host queue (#165): their lapse, and the host's call so far. */
export interface HostQueueItem {
  readonly itemId: string;
  readonly memberId: string;
  readonly fullName: string;
  readonly phone: string;
  readonly lastVisitAt: string;
  readonly visits: number;
  /** Offered once the host made an offer; open until then. */
  readonly status: 'open' | 'offered';
  readonly reason: HostChurnReason | null;
  readonly offer: PromotionEffect | null;
  readonly note: string | null;
}

/** Why a call was not kept: not a host here, the player left the queue, the venue frozen, or no connection. */
export type HostQueueFailure = 'not_allowed' | 'gone' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, HostQueueFailure>> = { '42501': 'not_allowed', RVHST: 'gone', RVFRZ: 'paused' };

const reasonOf = (reason: string | null): HostChurnReason | null => HOST_CHURN_REASONS.find((known) => known === reason) ?? null;
function offerOf(offer: Json | null): PromotionEffect | null {
  const parsed = promotionEffectSchema.safeParse(offer);
  return parsed.success ? parsed.data : null;
}

/** The venue's lapsed regulars, longest lapsed first, for staff with members.manage. */
export function useHostQueue(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queueKey(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<HostQueueItem[]> => {
      const { data, error } = await client.rpc('host_queue', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        itemId: row.item_id, memberId: row.member_id, fullName: row.full_name, phone: row.phone, lastVisitAt: row.last_visit_at, visits: row.visits,
        status: row.status === 'offered' ? 'offered' : 'open', reason: reasonOf(row.churn_reason), offer: offerOf(row.offer), note: row.note,
      }));
    },
  });
}

/** Records a host's call, or closes a player's item; each a Result, and the queue reloads. */
export function useHostQueueActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async ({ error }: { error: { code: string } | null }): Promise<Result<null, HostQueueFailure>> => {
    await queryClient.invalidateQueries({ queryKey: queueKey(userId ?? 'signed-out', venueId) });
    return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
  };
  const record = useMutation({
    mutationFn: async ({ itemId, contact }: { itemId: string; contact: HostContact }) =>
      settle(await client.rpc('record_host_contact', {
        p_item_id: itemId, p_churn_reason: contact.reason, p_offer: contact.offer, ...(contact.note === null ? {} : { p_note: contact.note }),
      })),
  });
  const close = useMutation({
    mutationFn: async (itemId: string) => settle(await client.rpc('close_host_item', { p_item_id: itemId })),
  });
  return { record, close };
}
