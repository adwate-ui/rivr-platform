import type { Permission } from '@rivr/contracts';
import { useAuthStatus, useControlState, useSignOut, useStaffVenue, useWaitingHighHands, type StaffVenueState } from '@rivr/db';
import { useRecordTableExport } from '@rivr/db/exports';
import { t } from '@rivr/i18n';
import { ConsoleShell, DataTableExportProvider, KillSwitchBanner, Screen } from '@rivr/ui';
import { Navigate, useNavigate, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { NotStaff } from './NotStaff.tsx';
import { isAllowedAt, isCageScreen, railFor, railItemAt } from './rail.ts';
import { SignOutButton } from './SignOutButton.tsx';
import { StaffFooter } from './StaffFooter.tsx';
import { useIdleLock } from './useIdleLock.ts';

/** Who is at the console and where, for a prompt the route puts across the top of every screen (#317). */
export interface FrameStaff {
  venueId: string;
  permissions: readonly Permission[];
  pathname: string;
}

/**
 * The console's frame for signed-in staff: the rail for their role at the venue the console works
 * in, the kill-switch banner, who is signed in, and the export of every table for staff who export them. Nobody signed in goes to sign-in; someone who
 * is not staff can only sign out. `prompt` is what waits for the staff member, across the top of every screen.
 */
export function Frame({ children, prompt }: { children: ReactNode; prompt?: (staff: FrameStaff) => ReactNode }) {
  const authStatus = useAuthStatus();
  const staff = useStaffVenue();
  if (authStatus === 'signed-out') return <Navigate to="/sign-in" replace />;
  if (staff.status === 'not-staff') return <NotStaff />;
  if (staff.status === 'ready') return <StaffFrame staff={staff} prompt={prompt}>{children}</StaffFrame>;
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

interface StaffFrameProps {
  staff: Extract<StaffVenueState, { status: 'ready' }>;
  prompt: ((staff: FrameStaff) => ReactNode) | undefined;
  children: ReactNode;
}

function StaffFrame({ staff, prompt, children }: StaffFrameProps) {
  const { venueId, permissions } = staff.venue;
  const { isVenueFrozen } = useControlState(venueId);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const signOut = useSignOut();
  // Ten idle minutes on a cage screen sign the cashier out (#384).
  useIdleLock(isCageScreen(pathname), signOut.mutate);
  // The rail counts the high-hand claims waiting for staff who approve them (#317).
  const waiting = useWaitingHighHands(venueId, permissions.includes('jackpots.approve'));
  const sections = railFor(permissions, { highHands: waiting.length });
  // Every table offers its export to staff who export tables, each recorded first (#102).
  const recordExport = useRecordTableExport(venueId);
  const exporter = permissions.includes('exports.table') ? recordExport : null;
  return (
    <ConsoleShell
      sections={sections}
      currentItem={railItemAt(sections, pathname)}
      onNavigate={(href) => void navigate({ href })}
      banner={<>{isVenueFrozen ? <KillSwitchBanner audience="staff" /> : null}{prompt?.({ venueId, permissions, pathname })}</>}
      railFooter={<StaffFooter staff={staff} />}
    >
      {/* A screen opened by address that the role doesn't include is refused here, before it loads anything. */}
      <DataTableExportProvider exporter={exporter}>
        {isAllowedAt(permissions, pathname) ? children : <Screen title={t('console.title')} status="error" errorText={t('console.notAllowed')} />}
      </DataTableExportProvider>
    </ConsoleShell>
  );
}
