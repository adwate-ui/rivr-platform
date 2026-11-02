import type { Permission } from '@rivr/contracts';
import { useAuthStatus, useControlState, useSignOut, useStaffQueueCounts, useStaffVenue, useWaitingHighHands, type StaffVenueState } from '@rivr/db';
import { useRecordTableExport } from '@rivr/db/exports';
import { t } from '@rivr/i18n';
import { Box, ConsoleShell, DataTableExportProvider, KillSwitchBanner, Screen, Text, TitleCount, UrgentChime } from '@rivr/ui';
import { Navigate, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect, type ReactNode } from 'react';
import { NotStaff } from './NotStaff.tsx';
import { isAllowedAt, landingFor, locksWhenIdle, railFor, railItemAt, isHiddenAt, URGENT_QUEUES } from './rail.ts';
import { SignOutButton } from './SignOutButton.tsx';
import { StaffFooter } from './StaffFooter.tsx';
import { useIdleLock } from './useIdleLock.ts';

/** Who is at the console and where, for a prompt the route puts across the top of every screen (#317). */
export interface FrameStaff {
  venueId: string;
  permissions: readonly Permission[];
  pathname: string;
  /** The address's search, `?tab=highHands`. */
  search: string;
}

/**
 * A screen the role does not include, refused, or one the club switched off, said to be off (C-04); but the Live floor's address, for a role without it (#640: Service), opens the
 * first screen the role has instead.
 */
function Refused({ landing, isOff }: { landing: string | undefined; isOff: boolean }) {
  const navigate = useNavigate();
  useEffect(() => {
    if (landing !== undefined) void navigate({ href: landing, replace: true });
  }, [landing, navigate]);
  const why = isOff ? t('console.switchedOff') : t('console.notAllowed');
  return landing === undefined ? <Screen title={t('console.title')} status="error" errorText={why} /> : null;
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

/**
 * On every screen while the console works in the practice venue (F1-07): a trainee never takes it for the club, nor the
 * club for it, where queues look empty and real members are not found.
 */
function PracticeBanner() {
  return (
    <Box surface="alert" paddingX={4} paddingY={2}>
      <Text as="span" variant="small" weight="medium" tone="onAlert">{t('console.practiceBanner')}</Text>
    </Box>
  );
}

/** The rail's counts, and the urgent queues' own: null until the first read, so the first read sounds nothing. */
function useRailCounts(venueId: string, permissions: readonly Permission[]) {
  // The high-hand claims waiting for staff who approve them (#317).
  const waiting = useWaitingHighHands(venueId, permissions.includes('jackpots.approve'));
  // And every queue the staff member acts on, the urgent ones in red (decision 0301).
  const queues = useStaffQueueCounts(venueId);
  const data = queues.data;
  const urgent = data === undefined ? null : Object.fromEntries(URGENT_QUEUES.map((queue) => [queue, data[queue] ?? 0]));
  return { counts: { jackpots: waiting.length, ...data }, urgent };
}

const totalOf = (counts: Readonly<Record<string, number>> | null) => Object.values(counts ?? {}).reduce((sum, count) => sum + count, 0);

function StaffFrame({ staff, prompt, children }: StaffFrameProps) {
  const { venueId, permissions } = staff.venue;
  const { isVenueFrozen } = useControlState(venueId);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const search = useRouterState({ select: (state) => state.location.searchStr });
  const signOut = useSignOut();
  // Ten idle minutes on a screen that locks sign the staff member out (#384).
  useIdleLock(locksWhenIdle(pathname), signOut.mutate);
  const { counts, urgent } = useRailCounts(venueId, permissions);
  const sections = railFor(permissions, counts, URGENT_QUEUES);
  // Every table offers its export to staff who export tables, each recorded first (#102).
  const recordExport = useRecordTableExport(venueId);
  const exporter = permissions.includes('exports.table') ? recordExport : null;
  return (
    <ConsoleShell
      sections={sections}
      currentItem={railItemAt(sections, pathname)}
      onNavigate={(href) => void navigate({ href })}
      banner={<>
        {isVenueFrozen ? <KillSwitchBanner audience="staff" /> : null}
        {staff.venue.isPractice ? <PracticeBanner /> : null}
        {prompt?.({ venueId, permissions, pathname, search })}
      </>}
      railFooter={<StaffFooter staff={staff} />}
    >
      {/* A screen opened by address that the role doesn't include is refused here, before it loads anything. */}
      <DataTableExportProvider exporter={exporter}>
        {/* New urgent work chimes and is told to a screen reader, and the tab says how much waits (decision 0301); a venue
            switch starts the chime over, so the other venue's counts sound nothing. */}
        <UrgentChime key={venueId} counts={urgent} />
        <TitleCount count={totalOf(urgent)}>
          {isAllowedAt(permissions, pathname) ? children : <Refused landing={pathname === '/' ? landingFor(sections) : undefined} isOff={isHiddenAt(pathname)} />}
        </TitleCount>
      </DataTableExportProvider>
    </ConsoleShell>
  );
}
