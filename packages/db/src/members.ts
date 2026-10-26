import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A member found on the Members screen (#60): number, name, mobile, tier and visits. */
export interface MemberRow {
  readonly memberId: string;
  readonly memberNumber: number;
  readonly fullName: string;
  /** Null once the member is erased (#424). */
  readonly phone: string | null;
  readonly tierName: string;
  readonly visits: number;
  readonly lastVisitAt: string | null;
}

/** One member's record (#60): tier and a change's last day, qualifying stake, KYC, visits and early departures (#79). */
export interface MemberRecord {
  readonly memberId: string;
  readonly memberNumber: number;
  readonly fullName: string;
  /** Null once the member is erased (#424). */
  readonly phone: string | null;
  readonly tierId: string;
  readonly tierName: string;
  /** A tier change's last club day (YYYY-MM-DD); null when the tier is for good. */
  readonly tierUntil: string | null;
  /** The stake a black card qualifies at, as blinds; null for none. */
  readonly qualifying: { readonly smallBlind: Paise; readonly bigBlind: Paise } | null;
  readonly isKycComplete: boolean;
  readonly photoPath: string | null;
  readonly visits: number;
  readonly lastVisitAt: string | null;
  readonly isInRoom: boolean;
  readonly earlyDepartures: number;
}

/** A member let go before their call time (#79): when, the call time owed, why and by whom. */
export interface EarlyDeparture {
  readonly earlyDepartureId: string;
  readonly at: string;
  readonly shortfallSeconds: number;
  readonly reason: string;
  readonly staffName: string;
}

/** A tier of the venue, most senior first. */
export interface VenueTier {
  readonly tierId: string;
  readonly name: string;
}

/** Why a tier change did not go through: not a member manager, no such member, a bad tier, reason or end, the venue frozen. */
export type MemberFailure = 'not_allowed' | 'no_member' | 'invalid' | 'paused' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, MemberFailure>> = { '42501': 'not_allowed', RVNOM: 'no_member', '22023': 'invalid', RVFRZ: 'paused' };

/** Whether a search is worth asking: a member number of any length, or two characters or more of a name or mobile. */
export function isMemberQuery(query: string): boolean {
  const typed = query.trim();
  return typed.length >= 2 || /^\d+$/.test(typed);
}

/** Members by name, mobile number or member number, for staff who read members. */
export function useMemberSearch(venueId: string, query: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.memberSearch(userId ?? 'signed-out', venueId, query.trim()),
    enabled: userId !== null && isMemberQuery(query),
    queryFn: async (): Promise<MemberRow[]> => {
      const { data, error } = await client.rpc('member_search', { p_venue_id: venueId, p_query: query.trim() });
      if (error) throw error;
      return data.map((row) => ({
        memberId: row.member_id, memberNumber: row.member_number, fullName: row.full_name, phone: row.phone, tierName: row.tier_name,
        visits: row.visits, lastVisitAt: row.last_visit_at,
      }));
    },
  });
}

/** One member's record; null when they are not a member of this venue. */
export function useMemberRecord(venueId: string, memberId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.memberRecord(userId ?? 'signed-out', venueId, memberId),
    enabled: userId !== null,
    queryFn: async (): Promise<MemberRecord | null> => {
      const { data, error } = await client.rpc('member_record', { p_venue_id: venueId, p_member_id: memberId });
      if (error) throw error;
      const row = data[0];
      if (row === undefined) return null;
      return {
        memberId: row.member_id, memberNumber: row.member_number, fullName: row.full_name, phone: row.phone, tierId: row.tier_id,
        tierName: row.tier_name, tierUntil: row.tier_until, isKycComplete: row.is_kyc_complete, photoPath: row.photo_path,
        qualifying: row.qualifying_small_blind === null || row.qualifying_big_blind === null ? null
          : { smallBlind: toPaise(row.qualifying_small_blind), bigBlind: toPaise(row.qualifying_big_blind) },
        visits: row.visits, lastVisitAt: row.last_visit_at, isInRoom: row.is_in_room, earlyDepartures: row.early_departures,
      };
    },
  });
}

/** A member's early departures, newest first. */
export function useMemberEarlyDepartures(venueId: string, memberId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.memberEarlyDepartures(userId ?? 'signed-out', venueId, memberId),
    enabled: userId !== null,
    queryFn: async (): Promise<EarlyDeparture[]> => {
      const { data, error } = await client.rpc('member_early_departures', { p_venue_id: venueId, p_member_id: memberId });
      if (error) throw error;
      return data.map((row) => ({
        earlyDepartureId: row.early_departure_id, at: row.created_at, shortfallSeconds: row.shortfall_seconds, reason: row.reason, staffName: row.staff_name,
      }));
    },
  });
}

/** Every member of a tier (additions flow 20), by name, at most 5,000, for staff who read members. */
export function useMembersOfTier(venueId: string, tierId: string | null) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.membersOfTier(userId ?? 'signed-out', venueId, tierId ?? ''),
    enabled: userId !== null && tierId !== null,
    queryFn: async (): Promise<MemberRow[]> => {
      const { data, error } = await client.rpc('members_of_tier', { p_venue_id: venueId, p_tier_id: tierId ?? '' });
      if (error) throw error;
      return data.map((row) => ({
        memberId: row.member_id, memberNumber: row.member_number, fullName: row.full_name, phone: row.phone, tierName: row.tier_name,
        visits: row.visits, lastVisitAt: row.last_visit_at,
      }));
    },
  });
}

/** The venue's tiers a member can be moved to, most senior first. */
export function useVenueTiers(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.venueTiers(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<VenueTier[]> => {
      const { data, error } = await client.from('tier').select('id, name').eq('venue_id', venueId).eq('is_retired', false).order('rank', { ascending: false });
      if (error) throw error;
      return data.map((row) => ({ tierId: row.id, name: row.name }));
    },
  });
}

/** A tier change: the tier, why, and its last club day (YYYY-MM-DD; it ends at 06:00 IST after), or null for good. */
export interface TierChange {
  readonly memberId: string;
  readonly tierId: string;
  readonly reason: string;
  readonly until: string | null;
}

/** `setTier` moves a member to a tier with a reason (members.manage); a Result, and it reloads the record and search. */
export function useMemberActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const setTier = useMutation({
    mutationFn: async (change: TierChange): Promise<Result<null, MemberFailure>> => {
      const { error } = await client.rpc('set_member_tier', {
        p_venue_id: venueId, p_member_id: change.memberId, p_tier_id: change.tierId, p_reason: change.reason,
        ...(change.until === null ? {} : { p_until: change.until }),
      });
      await queryClient.invalidateQueries({ queryKey: ['user', userId ?? 'signed-out'] });
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
  return { setTier };
}
