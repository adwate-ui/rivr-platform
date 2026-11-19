import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Json } from './database.types.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** One field a change by staff touched: its row's kind, its column, and its value before and after; `isHidden` for an identity number or document. */
export interface MemberStaffChangeField {
  readonly entity: string;
  readonly field: string;
  readonly before: Json;
  readonly after: Json;
  readonly isHidden: boolean;
}

/** One change staff made about a member (the owner, 19 Nov): who, when, what (a named action, or a row's insert, update or delete), why, and each field. */
export interface MemberStaffChange {
  readonly id: number;
  readonly at: string;
  readonly who: string;
  readonly action: string;
  readonly entity: string;
  /** The reason given; null when none was. */
  readonly reason: string | null;
  readonly fields: readonly MemberStaffChangeField[];
}

const isObject = (value: Json): value is { [key: string]: Json | undefined } => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The fields of a change as the server lists them; anything not shaped as one is left out. */
export function parseStaffChangeFields(changes: Json): MemberStaffChangeField[] {
  if (!Array.isArray(changes)) return [];
  return changes.flatMap((change) => {
    if (!isObject(change) || typeof change['entity'] !== 'string' || typeof change['field'] !== 'string') return [];
    return [{ entity: change['entity'], field: change['field'], before: change['before'] ?? null, after: change['after'] ?? null, isHidden: change['hidden'] === true }];
  });
}

/** A member's newest `count` changes by staff, newest first (members.phone, floor and up, as the Door's History). */
export function useMemberStaffHistory(venueId: string, memberId: string, count: number) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.memberStaffHistory(userId ?? 'signed-out', venueId, memberId, count),
    enabled: userId !== null,
    // Asking for more keeps the changes on screen until they come.
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<MemberStaffChange[]> => {
      const { data, error } = await client.rpc('member_staff_history', { p_venue_id: venueId, p_member_id: memberId, p_limit: count });
      if (error) throw error;
      return data.map((row) => ({
        id: row.id, at: row.occurred_at, who: row.who, action: row.action, entity: row.entity, reason: row.reason, fields: parseStaffChangeFields(row.changes),
      }));
    },
  });
}
