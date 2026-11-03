import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/notices).
const keys = {
  venue: (userId: string, venueId: string) => ['user', userId, 'venue-notices', venueId] as const,
  mine: (userId: string) => ['user', userId, 'my-notices'] as const,
};

/** A line the club shows at the top of members' Home (decision 0298). */
export interface Notice {
  readonly noticeId: string;
  readonly body: string;
}

/** A notice as Settings reads it: in force or still to come, with when it ends (null: until ended). */
export interface VenueNotice extends Notice {
  readonly startsAt: string;
  readonly endsAt: string | null;
}

/**
 * Why putting up, editing or ending a notice was refused: the role; empty, too long, an http link or an end before its
 * start; a freeze; edited after it ended (decision 0424); or anything else.
 */
export type NoticeFailure = 'not_allowed' | 'invalid' | 'paused' | 'ended' | 'unavailable';
const FAILURE_BY_CODE: Readonly<Record<string, NoticeFailure>> = { '42501': 'not_allowed', '22023': 'invalid', RVFRZ: 'paused', P0002: 'ended' };

/** A notice to put up: its words, its start (null: now) and its end (null: until ended). */
export interface NoticeDraft {
  readonly body: string;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
}

/** A notice's new words, start (null keeps it; a live notice keeps it anyway) and end (null: until ended). */
export interface NoticeEdit extends NoticeDraft {
  readonly noticeId: string;
}
const toFailure = (error: { code: string }): NoticeFailure => FAILURE_BY_CODE[error.code] ?? 'unavailable';

/** The notices in force at the member's club, newest first. */
export function useMyNotices() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.mine(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<Notice[]> => {
      const { data, error } = await client.rpc('my_notices');
      if (error) throw error;
      return data.map((row) => ({ noticeId: row.notice_id, body: row.body }));
    },
  });
}

/** The venue's notices in force or still to come, for staff with settings.manage. */
export function useVenueNotices(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.venue(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<VenueNotice[]> => {
      const { data, error } = await client.rpc('venue_notices', { p_venue_id: venueId });
      if (error) throw error;
      return data.map((row) => ({ noticeId: row.notice_id, body: row.body, startsAt: row.starts_at, endsAt: row.ends_at }));
    },
  });
}

/** Puts up a notice, now or for later, edits one in place and ends one; each a Result, and the list reloads. */
export function useNoticeActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const reload = () => queryClient.invalidateQueries({ queryKey: keys.venue(userId ?? 'signed-out', venueId) });
  const post = useMutation({
    mutationFn: async ({ body, startsAt, endsAt }: NoticeDraft): Promise<Result<string, NoticeFailure>> => {
      const { data, error } = await client.rpc('post_notice', {
        p_venue_id: venueId,
        p_body: body,
        // Left out, each is null in the function: it starts now and runs until ended.
        ...(startsAt === null ? {} : { p_starts_at: startsAt }),
        ...(endsAt === null ? {} : { p_ends_at: endsAt }),
      });
      await reload();
      return error ? err(toFailure(error)) : ok(data);
    },
  });
  const update = useMutation({
    mutationFn: async ({ noticeId, body, startsAt, endsAt }: NoticeEdit): Promise<Result<null, NoticeFailure>> => {
      const { error } = await client.rpc('update_notice', {
        p_notice_id: noticeId,
        p_body: body,
        // Left out, each is null in the function: the start kept, the notice running until ended.
        ...(startsAt === null ? {} : { p_starts_at: startsAt }),
        ...(endsAt === null ? {} : { p_ends_at: endsAt }),
      });
      await reload();
      return error ? err(toFailure(error)) : ok(null);
    },
  });
  const end = useMutation({
    mutationFn: async (noticeId: string): Promise<Result<null, NoticeFailure>> => {
      const { error } = await client.rpc('end_notice', { p_notice_id: noticeId });
      await reload();
      return error ? err(toFailure(error)) : ok(null);
    },
  });
  return { post, update, end };
}
