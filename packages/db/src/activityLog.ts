import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Database, Json } from './database.types.ts';
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

/** A high hand paid, on its line (redesign RD-24): the table and seat, and the hand as it was paid. */
export interface ActivityHighHand {
  readonly table: string;
  readonly seat: number;
  readonly hand: string;
  readonly rank: string | null;
}

/** The high hand a line carries, read from the log's own JSON; null for any other line. */
function highHandOf(value: Json | undefined): ActivityHighHand | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { table, seat, hand, rank } = value;
  if (typeof table !== 'string' || typeof seat !== 'number' || typeof hand !== 'string') return null;
  return { table, seat, hand, rank: typeof rank === 'string' ? rank : null };
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
  /** How many Bonus one decision on several members' approved or refused, which it names in place of a member; else null. */
  readonly decided: number | null;
  readonly reason: string | null;
  /** How much Bonus was added by hand, or paid for a high hand; null for anything else. */
  readonly amount: number | null;
  /** Where a high hand was paid and which hand; null for anything else. */
  readonly highHand: ActivityHighHand | null;
  /** The member `who` names, when the one who acted is a member (owner, 19 Nov: the name opens their account); else null. */
  readonly whoMemberId: string | null;
  /** The member `about` names, when it is about a member; else null. */
  readonly aboutMemberId: string | null;
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

/** A Bonus decision that is not one member's: the log gives how many it decided where it would name the member (decision 0670). */
function decidedOf(row: PageRow): number | null {
  return row.entity === 'promotion_bonus_decision' && row.about !== null && /^\d+$/.test(row.about) ? Number(row.about) : null;
}

const lineOf = (row: PageRow): ActivityLine => {
  const decided = decidedOf(row);
  return {
    id: row.id, occurredAt: row.occurred_at, who: row.who, isSystem: row.is_system, action: row.action, entity: row.entity,
    kind: ACTIVITY_KINDS.find((one) => one === row.kind) ?? 'other', about: decided === null ? row.about : null, decided, reason: row.reason,
    amount: row.amount, highHand: highHandOf(row.high_hand), whoMemberId: row.who_member_id, aboutMemberId: decided === null ? row.about_member_id : null,
  };
};

/**
 * One page of the venue's activity log for super admins, newest first, by its number (8 Nov audit, F-034; redesign RD-31:
 * the data table's foot pages it), with how many lines the narrowing leaves: counted no further than five thousand past
 * the page, and `isTotalAtLeast` when the count stopped there (#1015). Empty for anyone else. The page before
 * stays on screen while the next is read. `readEvery` reads every line the narrowing leaves, a thousand at a time, for
 * an export.
 */
export function useActivityPage(venueId: string, filters: ActivityFilters, page: number) {
  const { client, userId } = useRivrData();
  const log = useQuery({
    queryKey: [...queryKeys.activityLog(userId ?? 'signed-out', venueId, filters), page],
    enabled: userId !== null,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{ lines: ActivityLine[]; total: number; isTotalAtLeast: boolean }> => {
      const { data, error } = await client.rpc('activity_page', askOf(venueId, filters, page, ACTIVITY_PAGE));
      if (error) throw error;
      return { total: Number(data[0]?.total ?? 0), isTotalAtLeast: data[0]?.is_total_at_least === true, lines: data.map(lineOf) };
    },
  });
  const readEvery = (): Promise<ActivityLine[]> => readEveryRow((at) => client.rpc('activity_page', askOf(venueId, filters, at, EXPORT_PAGE)), lineOf);
  return { ...log, readEvery };
}
