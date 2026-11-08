import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

// Realtime tells the floor at once; this catches what a dropped connection missed.
const LIVE = 10_000;
// A burst of signals (a busy minute) reads once, a second after the first.
const SIGNAL_SETTLE = 1_000;

interface Seated {
  readonly memberId: string;
  readonly fullName: string;
  readonly tableId: string;
  readonly seat: number;
  /** When it began waiting: asked, marked leaving, or left. */
  readonly since: string;
}

/**
 * An approved player not yet seated (the owner, 8 Nov: "once somebody is approved, it should create an alert for seating
 * him"), `id` their waitlist place at `tableId`: `seat` to seat now, at the seat held for their call (`seat`) or any seat
 * free there (null); `seat_check` their identity check first; `seat_wait` their table full, until a seat frees.
 */
export interface SeatAlert {
  readonly kind: 'seat' | 'seat_check' | 'seat_wait';
  readonly id: string;
  readonly memberId: string;
  readonly fullName: string;
  readonly tableId: string;
  readonly since: string;
  readonly seat: number | null;
}

/** Whether a floor request is an approved player to seat, ready or not. */
export const isSeatAlert = (request: FloorRequest): request is SeatAlert =>
  request.kind === 'seat' || request.kind === 'seat_check' || request.kind === 'seat_wait';

/**
 * What waits on the Live floor (decision 0479), each with what the floor acts on: a join (`id` the waitlist place), a
 * top-up (`id` its request; started or not), more time (`id` its request, the length asked), a player leaving (`id` the
 * seat session), one who left owing call time (`id` the member), and an approved player to seat. A seated one has its
 * call time left, null for none.
 */
export type FloorRequest =
  | SeatAlert
  | { readonly kind: 'join'; readonly id: string; readonly memberId: string; readonly fullName: string; readonly tableId: string; readonly since: string }
  | (Seated & { readonly kind: 'top_up'; readonly id: string; readonly sessionId: string; readonly isStarted: boolean; readonly callTimeLeft: number | null })
  | (Seated & { readonly kind: 'time'; readonly id: string; readonly sessionId: string; readonly minutes: number; readonly callTimeLeft: number | null })
  | (Seated & { readonly kind: 'leaving'; readonly id: string; readonly sessionId: string; readonly callTimeLeft: number | null })
  | (Seated & { readonly kind: 'left_owing'; readonly id: string; readonly sessionId: string; readonly owedSeconds: number });

interface RequestRow {
  kind: string; request_id: string; session_id: string | null; member_id: string; full_name: string; table_id: string | null; seat: number | null;
  since: string; minutes: number | null; call_time_left: number | null; top_up: string | null; owed_seconds: number | null;
}

type SeatedWho = Seated & { readonly id: string; readonly sessionId: string };

/** A seated request's row as its kind, or nothing for a kind this console does not know. */
function toSeatedRequest(row: RequestRow, seated: SeatedWho): FloorRequest[] {
  switch (row.kind) {
    case 'top_up': return [{ kind: 'top_up', ...seated, isStarted: row.top_up === 'in_progress', callTimeLeft: row.call_time_left }];
    case 'time': return [{ kind: 'time', ...seated, minutes: row.minutes ?? 0, callTimeLeft: row.call_time_left }];
    case 'leaving': return [{ kind: 'leaving', ...seated, callTimeLeft: row.call_time_left }];
    case 'left_owing': return [{ kind: 'left_owing', ...seated, owedSeconds: row.owed_seconds ?? 0 }];
    default: return [];
  }
}

/** One row as a request: a join, an approved player to seat, or one at a seat. */
function toRequest(row: RequestRow): FloorRequest[] {
  const who = { id: row.request_id, memberId: row.member_id, fullName: row.full_name, since: row.since };
  if (row.kind === 'join') return [{ kind: 'join', ...who, tableId: row.table_id ?? '' }];
  if (row.kind === 'seat' || row.kind === 'seat_check' || row.kind === 'seat_wait') return [{ kind: row.kind, ...who, tableId: row.table_id ?? '', seat: row.seat }];
  return toSeatedRequest(row, { ...who, sessionId: row.session_id ?? '', tableId: row.table_id ?? '', seat: row.seat ?? 0 });
}

/** Everything that waits on the venue's floor, oldest first (`floor_requests`, waitlist.manage). */
export function useFloorRequests(venueId: string, isEnabled = true) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.floorRequests(userId ?? 'signed-out', venueId),
    enabled: userId !== null && isEnabled,
    refetchInterval: LIVE,
    queryFn: async (): Promise<FloorRequest[]> => {
      const { data, error } = await client.rpc('floor_requests', { p_venue_id: venueId });
      if (error) throw error;
      return data.flatMap(toRequest);
    },
  });
}

/**
 * Approve leads on to seating (the owner, 8 Nov): reads the floor's requests again and gives the approved place's alert
 * when a seat is free for it (`seat`, none held for a call), else null: its identity check comes first, or no seat is free
 * for it yet, and its alert waits on the requests instead.
 */
export function useReadyToSeat(venueId: string) {
  const requests = useFloorRequests(venueId, false);
  return async (entryId: string): Promise<SeatAlert | null> => {
    const alert = (await requests.refetch()).data?.filter(isSeatAlert).find((one) => one.id === entryId);
    return alert?.kind === 'seat' && alert.seat === null ? alert : null;
  };
}

/** The club's targets for how long a request waits before it shows late, in seconds; null where it set none (decision 0479). */
export interface FloorRequestTargets {
  readonly topUpSeconds: number | null;
  readonly otherSeconds: number | null;
}

/** The venue's request targets (`floor.request_targets`) for the floor; @rivr/domain's `requestTargets` fills what is unset. */
export function useFloorRequestTargets(venueId: string, isEnabled = true) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.floorRequestTargets(userId ?? 'signed-out', venueId),
    enabled: userId !== null && isEnabled,
    staleTime: 60_000,
    queryFn: async (): Promise<FloorRequestTargets> => {
      const { data, error } = await client.rpc('floor_request_targets', { p_venue_id: venueId });
      if (error) throw error;
      const row = data[0];
      return { topUpSeconds: row?.top_up_seconds ?? null, otherSeconds: row?.other_seconds ?? null };
    },
  });
}

/** Every read of the floor a signal makes stale: its seats, holds, tables, requests and lists, and the rail's counts. */
export function floorQueryKeys(userId: string, venueId: string) {
  return [
    queryKeys.floorSeats(userId, venueId), queryKeys.heldSeats(userId, venueId), queryKeys.floorTables(userId), queryKeys.floorRequests(userId, venueId),
    queryKeys.waitlistRequests(userId, venueId), queryKeys.waitlistBoard(userId, venueId), queryKeys.leftOwingCallTime(userId, venueId),
    queryKeys.topUpsTonight(userId, venueId), queryKeys.staffQueueCounts(userId, venueId),
  ];
}

/**
 * Live (decision 0479): reads the floor again when the database broadcasts on the venue's private topic (floor:<venue id>)
 * that something it shows changed, once a second after the first signal of a burst. For the floor only (`isEnabled`).
 */
export function useFloorSignals(venueId: string, isEnabled = true) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  useEffect(() => {
    // Only the floor (waitlist.manage) may hear the topic; anyone else would be refused it.
    if (userId === null || !isEnabled) return undefined;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const channel = client.channel(`floor:${venueId}`, { config: { private: true } });
    channel.on('broadcast', { event: 'changed' }, () => {
      if (pending !== null) return;
      pending = setTimeout(() => {
        pending = null;
        for (const queryKey of floorQueryKeys(userId, venueId)) void queryClient.invalidateQueries({ queryKey });
      }, SIGNAL_SETTLE);
    });
    channel.subscribe();
    return () => {
      if (pending !== null) clearTimeout(pending);
      void client.removeChannel(channel);
    };
  }, [client, queryClient, userId, venueId, isEnabled]);
}
