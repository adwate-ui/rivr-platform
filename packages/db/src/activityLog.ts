import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** The kinds of thing the Activity screen narrows to (`private.activity_kind`). */
export const ACTIVITY_KINDS = ['controls', 'exports', 'staff', 'bonus_chips', 'points', 'tiers', 'members', 'settings', 'floor', 'other'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/** What the Activity screen narrows the log by: club days (YYYY-MM-DD), part of a name and a kind; each may be left out. */
export interface ActivityFilters {
  readonly from: string | null;
  readonly to: string | null;
  readonly who: string | null;
  readonly kind: ActivityKind | null;
}

/** One line of the log: who did what, about whom, why and when. */
export interface ActivityLine {
  readonly id: number;
  readonly occurredAt: string;
  /** A staff member, a member or a device; null when the system did it, or a login since erased or removed. */
  readonly who: string | null;
  readonly isSystem: boolean;
  /** The kept code of what was done (`update`, `export.table`) and of the kind of record: `activityActionWord` and `activityEntityWord` give the words. */
  readonly action: string;
  readonly entity: string;
  readonly kind: ActivityKind;
  /** The member, staff member or table it was about, when it names one. */
  readonly about: string | null;
  readonly reason: string | null;
  /** How many points or bonus chips were given by hand; null for anything else. */
  readonly amount: number | null;
}

const PAGE_SIZE = 50;

/** Where the next page starts: after this line. Null for the first. */
type ActivityCursor = { readonly at: string; readonly id: number } | null;
const FIRST_PAGE: ActivityCursor = null;

/** The venue's activity log for super admins, newest first, a page at a time (8 Nov audit, F-034). Empty for anyone else. */
export function useActivityLog(venueId: string, filters: ActivityFilters) {
  const { client, userId } = useRivrData();
  return useInfiniteQuery({
    queryKey: queryKeys.activityLog(userId ?? 'signed-out', venueId, filters),
    enabled: userId !== null,
    initialPageParam: FIRST_PAGE,
    // The list stays while a typed name or a new date is read.
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<ActivityLine[]> => {
      const { data, error } = await client.rpc('activity_log', {
        p_venue_id: venueId, p_limit: PAGE_SIZE,
        ...(filters.from === null ? {} : { p_from: filters.from }), ...(filters.to === null ? {} : { p_to: filters.to }),
        ...(filters.who === null ? {} : { p_who: filters.who }), ...(filters.kind === null ? {} : { p_kind: filters.kind }),
        ...(pageParam === null ? {} : { p_before: pageParam.at, p_before_id: pageParam.id }),
      });
      if (error) throw error;
      return data.map((row) => ({
        id: row.id, occurredAt: row.occurred_at, who: row.who, isSystem: row.is_system, action: row.action, entity: row.entity,
        kind: ACTIVITY_KINDS.find((one) => one === row.kind) ?? 'other', about: row.about, reason: row.reason, amount: row.amount,
      }));
    },
    getNextPageParam: (last): ActivityCursor | undefined => {
      const end = last.at(-1);
      return end === undefined || last.length < PAGE_SIZE ? undefined : { at: end.occurredAt, id: end.id };
    },
  });
}
