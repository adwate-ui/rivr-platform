import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';
import { LIST_MOST } from './limits.ts';

/** A past visit to add (the owner, 25 Nov; #1134): whose, at which table, check-in and check-out, and why. */
export interface VisitToAdd {
  readonly memberId: string;
  readonly tableId: string;
  readonly openedAt: Date;
  readonly closedAt: Date;
  readonly reason: string;
}

/** What an add did: counted at once (a super admin's), waiting for a super admin, or, sent again, refused by one. */
export type AddVisitOutcome = 'added' | 'waiting' | 'refused';

/**
 * Why a visit was not added or decided: not one who adds (or decides) them, a staff member's own record, no such member or
 * table, the reason, check-out not after check-in or ahead of now, past the club day's end, into the member's other visit,
 * frozen or promotions stopped, too many at once, decided already by another super admin, or anything else.
 */
export type AddVisitFailure = 'not_allowed' | 'own_record' | 'no_member' | 'no_table' | 'invalid' | 'times' | 'club_day' | 'clash' | 'paused'
  | 'busy' | 'decided' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, AddVisitFailure>> = {
  '42501': 'not_allowed', RVOWN: 'own_record', RVNOM: 'no_member', RVTBL: 'no_table', '22023': 'invalid', RVVTM: 'times', RVVDY: 'club_day',
  RVVCL: 'clash', RVFRZ: 'paused', RVMBR: 'paused', RVKIL: 'paused', RVRAT: 'busy', RVVDD: 'decided',
};

/** Every read an added or decided visit changes: the member's record, visits, hours and waiting adds, the queues, Bonus waiting, and the counts. */
function useVisitsChanged(venueId: string) {
  const { userId } = useRivrData();
  const queryClient = useQueryClient();
  return async (memberId?: string) => {
    const user = userId ?? 'signed-out';
    const keys = [queryKeys.visitsWaiting(user, venueId), queryKeys.staffQueueCounts(user, venueId), queryKeys.membersListAll(user),
      queryKeys.clubReportsAt(user, venueId), queryKeys.bonusWaiting(user, venueId), ...(memberId === undefined ? [queryKeys.memberVisitsEvery(user, venueId)]
        : [queryKeys.memberVisitsAll(user, venueId, memberId), queryKeys.memberVisitRequests(user, venueId, memberId), queryKeys.memberRecord(user, venueId, memberId),
          queryKeys.memberHoursPlayed(user, venueId, memberId)])];
    await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  };
}

/**
 * Staff who add visits (visits.add) add a past one to the member's record (the owner, 25 Nov; #1134): a super admin's
 * counts at once, anyone else's waits for a super admin. The same `requestId` again gives the same answer.
 */
export function useAddVisit(venueId: string) {
  const { client } = useRivrData();
  const changed = useVisitsChanged(venueId);
  return useMutation({
    mutationFn: async ({ visit, requestId }: { visit: VisitToAdd; requestId: string }): Promise<Result<AddVisitOutcome, AddVisitFailure>> => {
      const { data, error } = await client.rpc('add_visit', {
        p_venue_id: venueId, p_member_id: visit.memberId, p_table_id: visit.tableId, p_opened_at: visit.openedAt.toISOString(),
        p_closed_at: visit.closedAt.toISOString(), p_reason: visit.reason.trim(), p_request_id: requestId,
      });
      await changed(visit.memberId);
      if (error) return err(FAILURE_BY_CODE[error.code] ?? 'unavailable');
      const status = data[0]?.o_status;
      return ok(status === 'added' || status === 'refused' ? status : 'waiting');
    },
  });
}

/** A member's added visit not yet counted: waiting for a super admin, or refused in the last seven days, with why. */
export interface VisitRequest {
  readonly requestId: string;
  readonly tableName: string;
  readonly openedAt: string;
  readonly closedAt: string;
  readonly isRefused: boolean;
  readonly refusal: string | null;
}

/** A member's added visits not yet counted, for staff who add visits; none for anyone else. */
export function useMemberVisitRequests(venueId: string, memberId: string, isEnabled = true) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.memberVisitRequests(userId ?? 'signed-out', venueId, memberId),
    enabled: userId !== null && isEnabled,
    queryFn: async (): Promise<VisitRequest[]> => {
      const { data, error } = await client.rpc('member_visit_requests', { p_venue_id: venueId, p_member_id: memberId }).limit(LIST_MOST);
      if (error) throw error;
      return data.map((row) => ({
        requestId: row.request_id, tableName: row.table_name, openedAt: row.opened_at, closedAt: row.closed_at, isRefused: row.status === 'refused',
        refusal: row.refusal,
      }));
    },
  });
}

/** A visit the floor or an admin added, waiting for a super admin: whose, the table, the times, why, and who asked. */
export interface WaitingVisitAdd {
  readonly requestId: string;
  readonly memberId: string;
  readonly memberNumber: number;
  readonly fullName: string;
  readonly tableName: string;
  readonly openedAt: string;
  readonly closedAt: string;
  readonly reason: string;
  readonly requestedBy: string;
  readonly requestedAt: string;
}

/** The visits waiting for a super admin, oldest asked first; none for anyone else. */
export function useVisitsWaiting(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.visitsWaiting(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<WaitingVisitAdd[]> => {
      const { data, error } = await client.rpc('visits_waiting', { p_venue_id: venueId }).limit(LIST_MOST);
      if (error) throw error;
      return data.map((row) => ({
        requestId: row.request_id, memberId: row.member_id, memberNumber: row.member_number, fullName: row.full_name, tableName: row.table_name,
        openedAt: row.opened_at, closedAt: row.closed_at, reason: row.reason, requestedBy: row.requested_by, requestedAt: row.requested_at,
      }));
    },
  });
}

/** A super admin approves a waiting visit, which then counts, or refuses it with a reason. */
export function useDecideVisit(venueId: string) {
  const { client } = useRivrData();
  const changed = useVisitsChanged(venueId);
  return useMutation({
    mutationFn: async (decision: { readonly request: WaitingVisitAdd; readonly isApproved: boolean; readonly reason?: string }): Promise<Result<null, AddVisitFailure>> => {
      const { error } = await client.rpc('decide_visit_request', {
        p_request_id: decision.request.requestId, p_approve: decision.isApproved, ...(decision.reason === undefined ? {} : { p_reason: decision.reason.trim() }),
      });
      await changed(decision.request.memberId);
      return error ? err(FAILURE_BY_CODE[error.code] ?? 'unavailable') : ok(null);
    },
  });
}

/** A line of a visit file as it is saved: its line in the file, and the visit. */
export interface VisitFileLine extends VisitToAdd {
  readonly line: number;
}

/** Why a visit file did not save, and the line its refusal names; null when none does. */
export interface VisitFileRefusal {
  readonly failure: AddVisitFailure;
  readonly line: number | null;
}

/** The line a refusal names in its detail, as private.visits_from_file gives it. */
function lineOf(detail: string | undefined): number | null {
  const line = Number(detail);
  return Number.isInteger(line) && line > 0 ? line : null;
}

/**
 * A super admin saves the visits of a file (the owner, 25 Nov; #1134): every line, in its order, or none. Resolves to how
 * many; the same `requestId` again gives the same count and adds nothing.
 */
export function useSaveVisitFile(venueId: string) {
  const { client } = useRivrData();
  const changed = useVisitsChanged(venueId);
  return useMutation({
    mutationFn: async (file: { readonly lines: readonly VisitFileLine[]; readonly requestId: string }): Promise<Result<number, VisitFileRefusal>> => {
      const lines = file.lines.map((line) => ({
        line: line.line, memberId: line.memberId, tableId: line.tableId, openedAt: line.openedAt.toISOString(), closedAt: line.closedAt.toISOString(), reason: line.reason.trim(),
      }));
      const { data, error } = await client.rpc('visits_from_file', { p_venue_id: venueId, p_lines: lines, p_request_id: file.requestId });
      await changed();
      if (error) return err({ failure: FAILURE_BY_CODE[error.code] ?? 'unavailable', line: lineOf(error.details) });
      return ok(data ?? 0);
    },
  });
}
