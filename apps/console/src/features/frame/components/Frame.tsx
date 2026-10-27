import type { Permission } from '@rivr/contracts';
import { useAuthStatus, useControlState, useHighHands, useSignOut, useStaffVenue, type HighHand, type StaffVenueState } from '@rivr/db';
import { useRecordTableExport } from '@rivr/db/exports';
import { t } from '@rivr/i18n';
import { ConsoleShell, DataTableExportProvider, KillSwitchBanner, Screen } from '@rivr/ui';
import { Navigate, useNavigate, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { HighHandPrompt } from '../../high-hands/index.ts';
import { NotStaff } from './NotStaff.tsx';
import { isAllowedAt, isCageScreen, railFor, railItemAt } from './rail.ts';
import { SignOutButton } from './SignOutButton.tsx';
import { StaffFooter } from './StaffFooter.tsx';
import { useIdleLock } from './useIdleLock.ts';

/**
 * The console's frame for signed-in staff: the rail for their role at the venue the console works
 * in, the kill-switch banner, who is signed in, and the export of every table for staff who export them. Nobody signed in goes to sign-in; someone who
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
  const signOut = useSignOut();
  // Ten idle minutes on a cage screen sign the cashier out (#384).
  useIdleLock(isCageScreen(pathname), signOut.mutate);
  const waiting = useWaitingClaims(staff.venue.venueId, staff.venue.permissions);
  const sections = railFor(staff.venue.permissions, { highHands: waiting.length });
  // The oldest claim waiting, on every screen but High hands, which lists them all (#317).
  const oldest = railItemAt(sections, pathname) === 'highHands' ? undefined : waiting.at(-1);
  // Every table offers its export to staff who export tables, each recorded first (#102).
  const recordExport = useRecordTableExport(staff.venue.venueId);
  const exporter = staff.venue.permissions.includes('exports.table') ? recordExport : null;
  return (
    <ConsoleShell
      sections={sections}
      currentItem={railItemAt(sections, pathname)}
      onNavigate={(href) => void navigate({ href })}
      banner={(
        <>
          {isVenueFrozen ? <KillSwitchBanner audience="staff" /> : null}
          {oldest === undefined ? null : (
            <HighHandPrompt key={oldest.claimId} venueId={staff.venue.venueId} hand={oldest} waiting={waiting.length}
              onSeeAll={() => void navigate({ to: '/high-hands' })} />
          )}
        </>
      )}
      railFooter={<StaffFooter staff={staff} />}
    >
      {/* A screen opened by address that the role doesn't include is refused here, before it loads anything. */}
      <DataTableExportProvider exporter={exporter}>
        {isAllowedAt(staff.venue.permissions, pathname) ? children : <Screen title={t('console.title')} status="error" errorText={t('console.notAllowed')} />}
      </DataTableExportProvider>
    </ConsoleShell>
  );
}

/**
 * The high-hand claims waiting for the floor, for staff who approve jackpots (#317), newest first: the same list the
 * High hands screen reads, asked every ten seconds; none for anyone else, who asks nothing.
 */
function useWaitingClaims(venueId: string, permissions: readonly Permission[]): readonly HighHand[] {
  const hands = useHighHands(venueId, permissions.includes('jackpots.approve'));
  return (hands.data ?? []).filter((hand) => hand.status === 'claimed');
}
