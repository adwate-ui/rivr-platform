import { err, ok, type Result } from '@rivr/contracts/result';
import type { StaffRole } from '@rivr/contracts/roles';
import type { StaffAdd } from '@rivr/contracts/staff';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** One of a venue's staff, as the Staff screen lists them (#28). */
export interface StaffMember {
  readonly staffId: string;
  readonly fullName: string;
  /** From the manpower plan: rosters use it, access does not. */
  readonly jobTitle: string;
  readonly role: StaffRole;
  /** The number they sign in with; null only for a dealer, who signs in with a PIN. */
  readonly phone: string | null;
  readonly isActive: boolean;
  /** The signed-in staff member, who changes neither their own role nor whether they are active. */
  readonly isMe: boolean;
}

/** A change to one staff member: their job title, role or whether they're active. */
export type StaffChange = { readonly jobTitle: string } | { readonly role: StaffRole } | { readonly isActive: boolean };

/**
 * Why a change to staff did not go through:
 * - `not_allowed`: a role the manager couldn't give, or no staff.manage;
 * - `already_staff`: that number is already on the venue's list (turn their row back on instead);
 * - `own_change`: their own role or turning themselves off;
 * - `last_super_admins`: it would leave fewer than two super admins able to release a freeze.
 * A freeze doesn't stop staff changes: a manager may need to turn someone off during one.
 */
export type StaffFailure = 'not_allowed' | 'already_staff' | 'own_change' | 'last_super_admins' | 'invalid' | 'unavailable';

const STAFF_FAILURE_BY_CODE: Readonly<Record<string, StaffFailure>> = {
  '42501': 'not_allowed', '23505': 'already_staff', RVOWN: 'own_change', RVLCK: 'last_super_admins', '23514': 'invalid', '22023': 'invalid',
};

function columnsOf(change: StaffChange) {
  if ('jobTitle' in change) return { job_title: change.jobTitle };
  if ('role' in change) return { role: change.role };
  return { is_active: change.isActive };
}

/** The venue's staff, active first, then by name. */
export function useVenueStaff(venueId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.venueStaff(userId ?? 'signed-out', venueId),
    enabled: userId !== null,
    queryFn: async (): Promise<StaffMember[]> => {
      const { data, error } = await client.from('staff').select('id, full_name, job_title, role, phone, is_active, user_id')
        .eq('venue_id', venueId).order('is_active', { ascending: false }).order('full_name');
      if (error) throw error;
      return data.map((row) => ({
        staffId: row.id, fullName: row.full_name, jobTitle: row.job_title, role: row.role, phone: row.phone,
        isActive: row.is_active, isMe: row.user_id !== null && row.user_id === userId,
      }));
    },
  });
}

/**
 * What staff with staff.manage do on the Staff screen: `add` someone, or `change` one person's job title,
 * role or whether they're active. The database decides who may (lane 0's policies, private.staff_guard)
 * and audits each change. Each resolves to a Result and reloads the list.
 */
export function useStaffActions(venueId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  const settle = async (error: { code: string } | null, wasApplied: boolean): Promise<Result<null, StaffFailure>> => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.venueStaff(userId ?? 'signed-out', venueId) });
    if (error) return err(STAFF_FAILURE_BY_CODE[error.code] ?? 'unavailable');
    // A row the policy hides from a change is no error, only nothing changed.
    return wasApplied ? ok(null) : err('not_allowed');
  };
  const add = useMutation({
    mutationFn: async (staff: StaffAdd) => {
      const { error } = await client.from('staff')
        .insert({ venue_id: venueId, full_name: staff.fullName, job_title: staff.jobTitle, role: staff.role, phone: staff.phone });
      return settle(error, true);
    },
  });
  const change = useMutation({
    mutationFn: async ({ staffId, change: update }: { staffId: string; change: StaffChange }) => {
      const { data, error } = await client.from('staff').update(columnsOf(update)).eq('id', staffId).select('id');
      return settle(error, (data ?? []).length > 0);
    },
  });
  return { add, change };
}
