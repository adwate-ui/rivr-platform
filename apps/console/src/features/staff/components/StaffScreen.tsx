import type { Permission } from '@rivr/contracts';
import { useStaffVenue, useVenueStaff } from '@rivr/db';
import { grantableRoles } from '@rivr/domain/staff';
import { t } from '@rivr/i18n';
import { Screen, Stack, Text } from '@rivr/ui';
import { AddStaffForm } from './AddStaffForm.tsx';
import { StaffRow } from './StaffRow.tsx';

/**
 * The venue's staff (#28; scope-v1 module 10), for staff with staff.manage: each with a job title from
 * the manpower plan, apart from the role that decides access. Add someone, change a job title or role,
 * turn someone off.
 */
export function StaffScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('staff.manage')) {
    return <Screen title={t('console.staff.title')} status="error" errorText={t('console.staff.notAllowed')} />;
  }
  return <StaffList venueId={staff.venue.venueId} permissions={staff.venue.permissions} />;
}

function StaffList({ venueId, permissions }: { venueId: string; permissions: readonly Permission[] }) {
  const members = useVenueStaff(venueId);
  const grantable = grantableRoles(permissions);
  const title = t('console.staff.title');
  if (members.isPending) return <Screen title={title} status="loading" />;
  // A failed refresh keeps what was known, so a job title half typed stays put.
  if (members.data === undefined) return <Screen title={title} status="error" onRetry={() => void members.refetch()} />;
  return (
    <Screen title={title}>
      {/* Adding comes first: a venue has some 40 staff, and the form shouldn't sit below them all. */}
      <Stack gap={8}>
        <AddStaffForm venueId={venueId} grantable={grantable} />
        {members.data.length === 0 ? <Text tone="muted">{t('console.staff.empty')}</Text> : (
          <Stack gap={4} divided>
            {members.data.map((member) => <StaffRow key={member.staffId} venueId={venueId} member={member} grantable={grantable} />)}
          </Stack>
        )}
      </Stack>
    </Screen>
  );
}
