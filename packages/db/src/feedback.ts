import { detailedFeedbackSchema, FEEDBACK_TOPICS, type FEEDBACK_RATED, type FeedbackTopic } from '@rivr/contracts/feedback';
import { err, ok, type Result } from '@rivr/contracts/result';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** The visit Home asks the member about (decision 0165): their last, closed in the week and not yet rated. */
export interface FeedbackVisit {
  readonly visitId: string;
  readonly closedAt: string;
  /** Time played across the visit's seats, and the table of the last: "Tonight · 2h 41m at Table 1" (decision 0320). */
  readonly playedSeconds: number;
  readonly tableName: string | null;
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
  /** The quick form's topic (#637); null for any other. */
  readonly topic: FeedbackTopic | null;
  /** The detailed form's ratings 1 to 5 and its recommendation 0 to 10 (#637); null for any other. */
  readonly ratings: FeedbackRatings | null;
  readonly nps: number | null;
}

/** The detailed form's four ratings, each 1 to 5 (#637). */
export type FeedbackRatings = Readonly<Record<(typeof FEEDBACK_RATED)[number], number>>;

/** The ratings as the database keeps them, or null when they do not read as the four. */
function ratingsOf(value: unknown): FeedbackRatings | null {
  const parsed = detailedFeedbackSchema.shape.ratings.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** A row of the console's lists, as the database gives it. */
interface FeedbackRow {
  readonly id: string;
  readonly member_id: string;
  readonly full_name: string;
  readonly member_number: number;
  readonly visit_closed_at: string | null;
  readonly score: number | null;
  readonly note: string | null;
  readonly is_ticket: boolean;
  readonly resolved_at: string | null;
  readonly resolved_by: string | null;
  readonly resolution: string | null;
  readonly created_at: string;
  readonly topic: string | null;
  readonly ratings: unknown;
  readonly nps: number | null;
}

function itemOf(row: FeedbackRow): FeedbackItem {
  return {
    id: row.id, memberId: row.member_id, fullName: row.full_name, memberNumber: row.member_number, visitClosedAt: row.visit_closed_at,
    score: row.score, note: row.note, isTicket: row.is_ticket, resolvedAt: row.resolved_at, resolvedBy: row.resolved_by,
    resolution: row.resolution, createdAt: row.created_at,
    topic: FEEDBACK_TOPICS.find((topic) => topic === row.topic) ?? null, ratings: ratingsOf(row.ratings), nps: row.nps,
  };
}

// The console's list asks again every minute.
const LIST_CHECK = 60_000;

/** How many are in each list (F-024): open tickets, tickets resolved and everything else of the last 90 days. */
export interface FeedbackCounts {
  readonly open: number;
  readonly resolved: number;
  readonly other: number;
}

/** A list read a page at a time: tickets resolved, or the ratings that never were tickets. */
export type FeedbackListName = 'resolved' | 'other';

/** The database's page: fewer than this means the last. */
const PAGE_SIZE = 50;

/** Where a page starts: after the row that ended the last one. */
interface FeedbackCursor {
  readonly at: string;
  readonly id: string;
}

const FIRST_PAGE: FeedbackCursor | null = null;

/** Each list's count, from the server, so a tab says how many there are however long the list (F-024). */
export function useFeedbackCounts(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.venueFeedbackCounts(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: LIST_CHECK,
    queryFn: async (): Promise<FeedbackCounts> => {
      const { data, error } = await client.rpc('feedback_counts', { p_venue_id: venueId });
      if (error) throw error;
      return data[0] ?? { open: 0, resolved: 0, other: 0 };
    },
  });
}

/** Tickets resolved, or the ratings that never were tickets, newest first, a page at a time (F-024). */
export function useFeedbackPage(venueId: string, list: FeedbackListName) {
  const { client, userId } = useRivrData();
  return useInfiniteQuery({
    queryKey: queryKeys.venueFeedbackPage(userId ?? 'signed-out', venueId, list),
    enabled: userId !== null,
    initialPageParam: FIRST_PAGE,
    queryFn: async ({ pageParam }): Promise<FeedbackItem[]> => {
      const { data, error } = await client.rpc('feedback_page', { p_venue_id: venueId, p_list: list, ...(pageParam ? { p_before: pageParam.at, p_before_id: pageParam.id } : {}) });
      if (error) throw error;
      return data.map(itemOf);
    },
    getNextPageParam: (last): FeedbackCursor | null => {
      const end = last.at(-1);
      return end === undefined || last.length < PAGE_SIZE ? null : { at: end.createdAt, id: end.id };
    },
  });
}

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
      return row ? { visitId: row.visit_id, closedAt: row.closed_at, playedSeconds: row.played_seconds, tableName: row.table_name } : null;
    },
  });
}

/**
 * The member's feedback: `rate` a visit 1 to 5 with a note if they like, `send` the club a note, or from Profile (#637)
 * `sendQuick` a topic with a note, or `sendDetailed` the four ratings, the recommendation and a note if they like. Each
 * is a Result.
 */
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
  const sendQuick = useMutation({
    mutationFn: async ({ topic, note }: { topic: FeedbackTopic; note: string }) =>
      settle((await client.rpc('send_quick_feedback', { p_topic: topic, p_note: note.trim() })).error),
  });
  const sendDetailed = useMutation({
    mutationFn: async ({ ratings, nps, note }: { ratings: FeedbackRatings; nps: number; note: string }) =>
      settle((await client.rpc('send_detailed_feedback', { p_ratings: ratings, p_nps: nps, p_note: note.trim() })).error),
  });
  return { rate, send, sendQuick, sendDetailed };
}

/** An open ticket as the triage table shows it (F-013): the visit's tables, and how long from check-in to a first seat. */
export interface OpenFeedback extends FeedbackItem {
  readonly tables: string | null;
  readonly waitSeconds: number | null;
}

/** Every open ticket, oldest first; the list is never cut (F-024). */
export function useOpenFeedback(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.venueFeedbackOpen(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    refetchInterval: LIST_CHECK,
    queryFn: async (): Promise<OpenFeedback[]> => {
      const { data, error } = await client.rpc('open_feedback', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({
        ...itemOf({ ...row, is_ticket: true, resolved_at: null, resolved_by: null, resolution: null }), tables: row.tables, waitSeconds: row.wait_seconds,
      }));
    },
  });
}

/** Why several tickets were not resolved: as any feedback failure, or more than the database takes at once. */
export type ResolveFeedbackFailure = FeedbackFailure | 'too_many';

/** Resolves several open tickets with one line of what was done, all or none (F-013): a Result, and every list reloads. */
export function useResolveFeedback(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ feedbackIds, resolution }: { feedbackIds: readonly string[]; resolution: string }): Promise<Result<null, ResolveFeedbackFailure>> => {
      const { error } = await client.rpc('resolve_feedback_many', { p_feedback_ids: [...feedbackIds], p_resolution: resolution.trim() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.venueFeedback(userId ?? 'signed-out', venueId) });
      if (error?.code === 'RVMAX') return err('too_many');
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
}
