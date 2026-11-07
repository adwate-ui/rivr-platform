import type { Permission } from '@rivr/contracts';
import { useStaffVenue, useVenueStaff } from '@rivr/db';
import { grantableRoles } from '@rivr/domain/staff';
import { t } from '@rivr/i18n';
import { Button, Screen } from '@rivr/ui';
import { useState } from 'react';
import { StaffTable, type StaffView } from './StaffTable.tsx';

/**
 * The venue's staff (#28; scope-v1 module 10), for staff with staff.manage: each with a job title from
 * the manpower plan, apart from the role that decides access. Find someone in the table, add someone, change a job
 * title or role, turn someone off; or, under Removed staff (owner, 8 Nov), see when each was turned off and restore them.
 */
export function StaffSection({ view }: { view: StaffView }) {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('staff.manage')) {
    return <Screen level={2} title={t(`console.staff.tabs.${view === 'removed' ? 'removed' : 'staff'}`)} status="error" errorText={t('console.staff.notAllowed')} />;
  }
  return <StaffList venueId={staff.venue.venueId} permissions={staff.venue.permissions} view={view} />;
}

function StaffList({ venueId, permissions, view }: { venueId: string; permissions: readonly Permission[]; view: StaffView }) {
  const members = useVenueStaff(venueId);
  const [isAdding, setIsAdding] = useState(false);
  const grantable = grantableRoles(permissions);
  const title = t(`console.staff.tabs.${view === 'removed' ? 'removed' : 'staff'}`);
  if (members.isPending) return <Screen level={2} title={title} status="loading" loadingLook="rows" />;
  // A failed refresh keeps what was known, so a job title half typed stays put.
  if (members.data === undefined) return <Screen level={2} title={title} status="error" onRetry={() => void members.refetch()} />;
  // The screen's one gold action (decision 0463); one button opens and closes the form, so focus stays on it.
  const add = (
    <Button variant="primary" size="compact" onClick={() => setIsAdding(!isAdding)}>{isAdding ? t('common.close') : t('console.staff.addOpen')}</Button>
  );
  // Staff are added to the working list; Removed staff has no Add.
  return (
    <Screen level={2} title={title} actions={view === 'active' ? add : undefined}>
      <StaffTable venueId={venueId} members={members.data} grantable={grantable} isAdding={view === 'active' && isAdding} view={view} />
    </Screen>
  );
}
