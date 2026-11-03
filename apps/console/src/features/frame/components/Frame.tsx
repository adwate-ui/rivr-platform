import type { Permission } from '@rivr/contracts';
import { useAuthStatus, useControlState, useSignOut, useStaffDensity, useStaffQueueCounts, useStaffVenue, useWaitingHighHands, type StaffVenueState } from '@rivr/db';
import { useRecordTableExport } from '@rivr/db/exports';
import { t } from '@rivr/i18n';
import {
  ConsoleShell, DataTableDensityProvider, DataTableExportProvider, KillSwitchBanner, PracticeBanner, Screen, ShortcutProvider, TitleCount, ToastProvider, UrgentChime,
} from '@rivr/ui';
import { Navigate, useNavigate, useRouterState } from '@tanstack/react-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ConsoleSearch } from './ConsoleSearch.tsx';
import { FrameClock, FramePulse } from './FrameHeader.tsx';
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
  if (staff.status === 'ready') {
    // The keys the screen open now offers (useShortcut), and the menu's list of them; and the toasts every step raises,
    // with Undo where the step has its own compensating call (console v3).
    return (
      <ShortcutProvider>
        <ToastProvider place="console"><StaffFrame staff={staff} prompt={prompt} onIdle={onIdle}>{children}</StaffFrame></ToastProvider>
      </ShortcutProvider>
    );
  }
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
    ...location, counts, urgent, sections: railFor(permissions, counts), tabs: phoneTabsFor(permissions, counts),
    refusal: refusalAt(permissions, location.pathname, location.tab),
  };
}

/**
 * Across the top, above everything: the kill switch's banner, the practice venue's stripe on every screen while the
 * console works there (F1-07, decision 0477), so nobody takes it for the club, with the way back; and any prompt.
 */
function FrameBanner({ staff, prompt, location }: { staff: ReadyStaff; prompt: StaffFrameProps['prompt']; location: { pathname: string; search: string } }) {
  const { venueId, permissions, isPractice } = staff.venue;
  const { isVenueFrozen } = useControlState(venueId);
  return (
    <>
      {isVenueFrozen ? <KillSwitchBanner audience="staff" /> : null}
      {isPractice ? (
        <PracticeBanner message={t('console.practiceBanner')} action={{ label: t('console.shell.backToClub'), onPress: () => staff.setPractice(false) }} />
      ) : null}
      {prompt?.({ venueId, permissions, ...location })}
    </>
  );
}

interface FrameBodyProps {
  staff: ReadyStaff;
  urgent: Readonly<Record<string, number>> | null;
  /** The screen open now is refused: why, under its name; or undefined. */
  refusal: Refusal | undefined;
  landing: string | undefined;
  children: ReactNode;
}

/** The screen, or its refusal, with what every screen shares: the staff member's density, the export, the chime. */
function FrameBody({ staff, urgent, refusal, landing, children }: FrameBodyProps) {
  const { venueId, permissions } = staff.venue;
  const density = useStaffDensity(venueId);
  // Every table offers its export to staff who export tables, each recorded first (#102).
  const recordExport = useRecordTableExport(venueId);
  return (
    <DataTableDensityProvider density={density.data ?? 'comfortable'}>
      <DataTableExportProvider exporter={permissions.includes('exports.table') ? recordExport : null}>
        {/* New urgent work chimes and is told to a screen reader, and the tab says how much waits (decision 0301); a venue
            switch starts the chime over, so the other venue's counts sound nothing. */}
        <UrgentChime key={venueId} counts={urgent} />
        <TitleCount count={totalOf(urgent)}>
          {/* A screen opened by address that the role doesn't include is refused here, before it loads anything. */}
          {refusal === undefined ? children : <Refused refusal={refusal} landing={landing} />}
        </TitleCount>
      </DataTableExportProvider>
    </DataTableDensityProvider>
  );
}

function StaffFrame({ staff, prompt, onIdle, children }: StaffFrameProps) {
  const { venueId, permissions } = staff.venue;
  const navigate = useNavigate();
  const { pathname, search, counts, urgent, sections, tabs, refusal } = useStaffShell(staff, onIdle);
  return (
    <ConsoleShell
      sections={sections}
      tabs={tabs}
      currentItem={railItemAt(pathname)}
      title={refusal?.title}
      // The Live floor docks its requests at the screen's edge, so it lays out its own gutter (decision 0482).
      isFullBleed={pathname === '/' && refusal === undefined}
      onNavigate={(href) => void navigate({ href })}
      banner={<FrameBanner staff={staff} prompt={prompt} location={{ pathname, search }} />}
      search={<ConsoleSearch venueId={venueId} permissions={permissions} sections={sections} />}
      pulse={<FramePulse venueId={venueId} permissions={permissions} counts={counts} />}
      clock={<FrameClock />}
      account={<StaffAccount staff={staff} />}
    >
      <FrameBody staff={staff} urgent={urgent} refusal={refusal} landing={pathname === '/' ? landingFor(sections) : undefined}>{children}</FrameBody>
    </ConsoleShell>
  );
}
