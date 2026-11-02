import type { Permission } from '@rivr/contracts';
import { useStaffVenue, useVenueStaff } from '@rivr/db';
import { grantableRoles } from '@rivr/domain/staff';
import { t } from '@rivr/i18n';
import { Screen } from '@rivr/ui';
import { StaffTable } from './StaffTable.tsx';

/**
 * The venue's staff (#28; scope-v1 module 10), for staff with staff.manage: each with a job title from
 * the manpower plan, apart from the role that decides access. Find someone in the table, add someone, change a job
 * title or role, turn someone off.
 */
export function StaffSection() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('staff.manage')) {
    return <Screen level={2} title={t('console.staff.tabs.staff')} status="error" errorText={t('console.staff.notAllowed')} />;
  }
  return <StaffList venueId={staff.venue.venueId} permissions={staff.venue.permissions} />;
}

function StaffList({ venueId, permissions }: { venueId: string; permissions: readonly Permission[] }) {
  const members = useVenueStaff(venueId);
  const grantable = grantableRoles(permissions);
  const title = t('console.staff.tabs.staff');
  if (members.isPending) return <Screen level={2} title={title} status="loading" />;
  // A failed refresh keeps what was known, so a job title half typed stays put.
  if (members.data === undefined) return <Screen level={2} title={title} status="error" onRetry={() => void members.refetch()} />;
  return (
    <Screen level={2} title={title}>
      <StaffTable venueId={venueId} members={members.data} grantable={grantable} />
    </Screen>
  );
}
