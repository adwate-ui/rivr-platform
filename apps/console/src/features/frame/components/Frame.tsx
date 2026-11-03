import type { Permission } from '@rivr/contracts';
import { useAuthStatus, useControlState, useSignOut, useStaffQueueCounts, useStaffVenue, useWaitingHighHands, type StaffVenueState } from '@rivr/db';
import { useRecordTableExport } from '@rivr/db/exports';
import { t } from '@rivr/i18n';
import { Box, ConsoleShell, DataTableExportProvider, KillSwitchBanner, Screen, Text, TitleCount, UrgentChime } from '@rivr/ui';
import { Navigate, useNavigate, useRouterState } from '@tanstack/react-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ConsoleSearch } from './ConsoleSearch.tsx';
import { NotStaff } from './NotStaff.tsx';
import { landingFor, locksWhenIdle, phoneTabsFor, railFor, railItemAt, refusalAt, URGENT_QUEUES, type Refusal } from './rail.ts';
import { SignOutButton } from './SignOutButton.tsx';
import { StaffAccount } from './StaffAccount.tsx';
import { useIdleLock } from './useIdleLock.ts';

/** Who is at the console and where, for a prompt the route puts across the top of every screen (#317). */
export interface FrameStaff {
  venueId: string;
  permissions: readonly Permission[];
  pathname: string;
  /** The address's search, `?tab=highHands`. */
  search: string;
}

type ReadyStaff = Extract<StaffVenueState, { status: 'ready' }>;

/**
 * A screen the role does not include, refused, or one the club switched off, said to be off (C-04), under the screen's own
 * name (#811); but the Live floor's address, for a role without it (#640: Service), opens the first screen the role has.
 */
function Refused({ refusal, landing }: { refusal: Refusal; landing: string | undefined }) {
  const navigate = useNavigate();
  useEffect(() => {
    if (landing !== undefined) void navigate({ href: landing, replace: true });
  }, [landing, navigate]);
  const why = refusal.isOff ? t('console.switchedOff') : t('console.notAllowed');
  return landing === undefined ? <Screen title={refusal.title} status="error" errorText={why} /> : null;
}

/**
 * The console's frame for signed-in staff: the rail for their role at the venue the console works in, the header, the
 * kill-switch banner, and the export of every table for staff who export them. Nobody signed in goes to sign-in, told why
 * when the idle lock signed them out (#811); someone who is not staff can only sign out. `prompt` is what waits for the
 * staff member, across the top of every screen.
 */
export function Frame({ children, prompt }: { children: ReactNode; prompt?: (staff: FrameStaff) => ReactNode }) {
  const authStatus = useAuthStatus();
  const staff = useStaffVenue();
  const [isIdleLocked, setIdleLocked] = useState(false);
  const onIdle = useCallback(() => setIdleLocked(true), []);
  if (authStatus === 'signed-out') return <Navigate to="/sign-in" search={isIdleLocked ? { why: 'idle' } : {}} replace />;
  if (staff.status === 'not-staff') return <NotStaff />;
  if (staff.status === 'ready') return <StaffFrame staff={staff} prompt={prompt} onIdle={onIdle}>{children}</StaffFrame>;
  // Until the staff record loads, or if it cannot, the header still offers a way out, and the rail stays empty (#811).
  return (
    <ConsoleShell sections={[]} account={<SignOutButton />}>
      {staff.status === 'error' ? (
        <Screen title={t('console.title')} status="error" onRetry={staff.retry} />
      ) : (
        <Screen title={t('console.title')} status="loading" />
      )}
    </ConsoleShell>
  );
}

interface StaffFrameProps {
  staff: ReadyStaff;
  prompt: ((staff: FrameStaff) => ReactNode) | undefined;
  /** The idle lock is signing the staff member out. */
  onIdle: () => void;
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
  // And every queue the staff member acts on (decision 0301).
  const queues = useStaffQueueCounts(venueId);
  const data = queues.data;
  const urgent = data === undefined ? null : Object.fromEntries(URGENT_QUEUES.map((queue) => [queue, data[queue] ?? 0]));
  return { counts: { jackpots: waiting.length, ...data }, urgent };
}

const totalOf = (counts: Readonly<Record<string, number>> | null) => Object.values(counts ?? {}).reduce((sum, count) => sum + count, 0);

/** The screen open now: its address, the tab named in it, and the whole search for a prompt. */
function useLocation() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const search = useRouterState({ select: (state) => state.location.searchStr });
  return { pathname, search, tab: new URLSearchParams(search).get('tab') ?? undefined };
}

/** Where the staff member is and what waits for them: the rail and tabs with their counts, any refusal, and the idle lock. */
function useStaffShell(staff: ReadyStaff, onIdle: () => void) {
  const { venueId, permissions } = staff.venue;
  const location = useLocation();
  const { mutate: signOut } = useSignOut();
  // Ten idle minutes on a screen that locks sign the staff member out (#384), and sign-in says why (#811).
  const lock = useCallback(() => {
    onIdle();
    signOut();
  }, [onIdle, signOut]);
  useIdleLock(locksWhenIdle(location.pathname), lock);
  const { counts, urgent } = useRailCounts(venueId, permissions);
  return {
    ...location, urgent, sections: railFor(permissions, counts), tabs: phoneTabsFor(permissions, counts),
    refusal: refusalAt(permissions, location.pathname, location.tab),
  };
}

function StaffFrame({ staff, prompt, onIdle, children }: StaffFrameProps) {
  const { venueId, permissions } = staff.venue;
  const { isVenueFrozen } = useControlState(venueId);
  const navigate = useNavigate();
  const { pathname, search, urgent, sections, tabs, refusal } = useStaffShell(staff, onIdle);
  // Every table offers its export to staff who export tables, each recorded first (#102).
  const recordExport = useRecordTableExport(venueId);
  const exporter = permissions.includes('exports.table') ? recordExport : null;
  return (
    <ConsoleShell
      sections={sections}
      tabs={tabs}
      currentItem={railItemAt(pathname)}
      title={refusal?.title}
      onNavigate={(href) => void navigate({ href })}
      banner={<>
        {isVenueFrozen ? <KillSwitchBanner audience="staff" /> : null}
        {staff.venue.isPractice ? <PracticeBanner /> : null}
        {prompt?.({ venueId, permissions, pathname, search })}
      </>}
      search={<ConsoleSearch venueId={venueId} permissions={permissions} sections={sections} />}
      account={<StaffAccount staff={staff} shortcuts={[]} />}
    >
      <DataTableExportProvider exporter={exporter}>
        {/* New urgent work chimes and is told to a screen reader, and the tab says how much waits (decision 0301); a venue
            switch starts the chime over, so the other venue's counts sound nothing. */}
        <UrgentChime key={venueId} counts={urgent} />
        <TitleCount count={totalOf(urgent)}>
          {/* A screen opened by address that the role doesn't include is refused here, before it loads anything. */}
          {refusal === undefined ? children : <Refused refusal={refusal} landing={pathname === '/' ? landingFor(sections) : undefined} />}
        </TitleCount>
      </DataTableExportProvider>
    </ConsoleShell>
  );
}
