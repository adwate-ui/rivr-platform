import { useAuthStatus, useControlState, useStaffVenue, type StaffVenueState } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ConsoleShell, KillSwitchBanner, Screen } from '@rivr/ui';
import { Navigate, useNavigate, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { NotStaff } from './NotStaff.tsx';
import { railFor, railItemAt } from './rail.ts';
import { SignOutButton } from './SignOutButton.tsx';
import { StaffFooter } from './StaffFooter.tsx';

/**
 * The console's frame for signed-in staff: the rail for their role at the venue the console works
 * in, the kill-switch banner, and who is signed in. Nobody signed in goes to sign-in; someone who
 * is not staff can only sign out.
 */
export function Frame({ children }: { children: ReactNode }) {
  const authStatus = useAuthStatus();
  const staff = useStaffVenue();
  if (authStatus === 'signed-out') return <Navigate to="/sign-in" replace />;
  if (staff.status === 'not-staff') return <NotStaff />;
  if (staff.status === 'ready') return <StaffFrame staff={staff}>{children}</StaffFrame>;
  // Until the staff record loads, or if it cannot, the rail still offers a way out.
  return (
    <ConsoleShell sections={[]} railFooter={<SignOutButton />}>
      {staff.status === 'error' ? (
        <Screen title={t('console.title')} status="error" onRetry={staff.retry} />
      ) : (
        <Screen title={t('console.title')} status="loading" />
      )}
    </ConsoleShell>
  );
}

function StaffFrame({ staff, children }: { staff: Extract<StaffVenueState, { status: 'ready' }>; children: ReactNode }) {
  const { isVenueFrozen } = useControlState(staff.venue.venueId);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const sections = railFor(staff.venue.permissions);
  return (
    <ConsoleShell
      sections={sections}
      currentItem={railItemAt(sections, pathname)}
      onNavigate={(href) => void navigate({ href })}
      banner={isVenueFrozen ? <KillSwitchBanner audience="staff" /> : null}
      railFooter={<StaffFooter staff={staff} />}
    >
      {children}
    </ConsoleShell>
  );
}
