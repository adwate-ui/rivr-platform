import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** The visit Home asks the member about (decision 0165): their last, closed in the week and not yet rated. */
export interface FeedbackVisit {
  readonly visitId: string;
  readonly closedAt: string;
}

/**
 * Why feedback did not go through: not the member's, a score outside 1 to 5 or an empty or long note,
 * rated already, a visit too old to rate, the member or the venue frozen, or anything else.
 */
export type FeedbackFailure = 'not_allowed' | 'invalid' | 'already_rated' | 'too_old' | 'stopped' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, FeedbackFailure>> = {
  '42501': 'not_allowed', '22023': 'invalid', RVDUP: 'already_rated', RVOLD: 'too_old', RVMBR: 'stopped', RVFRZ: 'paused',
};

/** A rating or note on the console's Feedback screen; a ticket stays open until the General Manager resolves it. */
export interface FeedbackItem {
  readonly id: string;
  readonly memberId: string;
  readonly fullName: string;
  readonly memberNumber: number;
  /** When the visit rated closed; null for a note sent from Profile. */
  readonly visitClosedAt: string | null;
  /** 1 to 5; null for a note sent from Profile. */
  readonly score: number | null;
  readonly note: string | null;
  readonly isTicket: boolean;
  readonly resolvedAt: string | null;
  readonly resolvedBy: string | null;
  readonly resolution: string | null;
  readonly createdAt: string;
}

// The console's list asks again every minute.
const LIST_CHECK = 60_000;

/** The signed-in member's visit to rate on Home, or null when there is none. */
export function useMyFeedbackVisit() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.myFeedbackVisit(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<FeedbackVisit | null> => {
      const { data, error } = await client.rpc('my_feedback_visit');
      if (error) throw error;
      const row = data[0];
      return row ? { visitId: row.visit_id, closedAt: row.closed_at } : null;
    },
  });
}

/** The member's feedback: `rate` a visit 1 to 5 with a note if they like, or `send` the club a note. Each is a Result. */
export function useFeedbackActions() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async (error: { code: string } | null): Promise<Result<null, FeedbackFailure>> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.myFeedbackVisit(userId ?? 'signed-out') });
    return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
  };
  const rate = useMutation({
    mutationFn: async ({ visitId, score, note }: { visitId: string; score: number; note: string }) =>
      settle((await client.rpc('rate_visit', { p_visit_id: visitId, p_score: score, p_note: note.trim() })).error),
  });
  const send = useMutation({
    mutationFn: async (note: string) => settle((await client.rpc('send_feedback', { p_note: note.trim() })).error),
  });
  return { rate, send };
}

/** The venue's feedback for the General Manager (feedback.manage): open tickets first, then the last 90 days. */
export function useVenueFeedback(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.venueFeedback(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: LIST_CHECK,
    queryFn: async (): Promise<FeedbackItem[]> => {
      const { data, error } = await client.rpc('venue_feedback', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        id: row.id, memberId: row.member_id, fullName: row.full_name, memberNumber: row.member_number, visitClosedAt: row.visit_closed_at,
        score: row.score, note: row.note, isTicket: row.is_ticket, resolvedAt: row.resolved_at, resolvedBy: row.resolved_by,
        resolution: row.resolution, createdAt: row.created_at,
      }));
    },
  });
}

/** The General Manager resolves a ticket with what was done; a Result, and the list reloads. */
export function useResolveFeedback(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ feedbackId, resolution }: { feedbackId: string; resolution: string }): Promise<Result<null, FeedbackFailure>> => {
      const { error } = await client.rpc('resolve_feedback', { p_feedback_id: feedbackId, p_resolution: resolution.trim() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.venueFeedback(userId ?? 'signed-out', venueId) });
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
}
