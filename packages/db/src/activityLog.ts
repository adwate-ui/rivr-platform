import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Database } from './database.types.ts';
import { EXPORT_PAGE, readEveryRow } from './lists.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** The kinds of thing the Activity screen narrows to (`private.activity_kind`). */
export const ACTIVITY_KINDS = ['controls', 'exports', 'staff', 'bonus_chips', 'tiers', 'members', 'settings', 'floor', 'other'] as const;
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
  /** How many bonus chips were given by hand; null for anything else. */
  readonly amount: number | null;
}

/** How many lines a page holds, and how many an export reads at a time. */
export const ACTIVITY_PAGE = 50;

/** What `activity_page` is asked: the venue, what narrows the log, and a page by its number. */
function askOf(venueId: string, filters: ActivityFilters, page: number, pageSize: number) {
  return {
    p_venue_id: venueId, p_page: page, p_page_size: pageSize,
    ...(filters.from === null ? {} : { p_from: filters.from }), ...(filters.to === null ? {} : { p_to: filters.to }),
    ...(filters.who === null ? {} : { p_who: filters.who }), ...(filters.kind === null ? {} : { p_kind: filters.kind }),
  };
}

type PageRow = Database['public']['Functions']['activity_page']['Returns'][number];

const lineOf = (row: PageRow): ActivityLine => ({
  id: row.id, occurredAt: row.occurred_at, who: row.who, isSystem: row.is_system, action: row.action, entity: row.entity,
  kind: ACTIVITY_KINDS.find((one) => one === row.kind) ?? 'other', about: row.about, reason: row.reason, amount: row.amount,
});

/**
 * One page of the venue's activity log for super admins, newest first, by its number (8 Nov audit, F-034; redesign RD-31:
 * the data table's foot pages it), with how many lines the narrowing leaves. Empty for anyone else. The page before
 * stays on screen while the next is read. `readEvery` reads every line the narrowing leaves, a thousand at a time, for
 * an export.
 */
export function useActivityPage(venueId: string, filters: ActivityFilters, page: number) {
  const { client, userId } = useRivrData();
  const log = useQuery({
    queryKey: [...queryKeys.activityLog(userId ?? 'signed-out', venueId, filters), page],
    enabled: userId !== null,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{ lines: ActivityLine[]; total: number }> => {
      const { data, error } = await client.rpc('activity_page', askOf(venueId, filters, page, ACTIVITY_PAGE));
      if (error) throw error;
      return { total: Number(data[0]?.total ?? 0), lines: data.map(lineOf) };
    },
  });
  const readEvery = (): Promise<ActivityLine[]> => readEveryRow((at) => client.rpc('activity_page', askOf(venueId, filters, at, EXPORT_PAGE)), lineOf);
  return { ...log, readEvery };
}
