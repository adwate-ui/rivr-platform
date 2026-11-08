import type { Permission } from '@rivr/contracts';
import {
  useAuthStatus, useControlState, useSignOut, useStaffDensity, useStaffQueueCounts, useStaffShortcuts, useStaffVenue, useWaitingHighHands, type StaffVenueState,
} from '@rivr/db';
import { useRecordTableExport } from '@rivr/db/exports';
import { t } from '@rivr/i18n';
import {
  ConsoleShell, DataTableDensityProvider, DataTableExportProvider, DataTableViewProvider, KillSwitchBanner, PracticeBanner, Screen, ShortcutProvider, TitleCount, ToastProvider, UrgentChime,
} from '@rivr/ui';
import { Navigate, useNavigate, useRouterState } from '@tanstack/react-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ConsoleSearch } from './ConsoleSearch.tsx';
import { FrameClock, FramePulse } from './FrameHeader.tsx';
import { NotStaff } from './NotStaff.tsx';
import { useAddressTableViews } from './tableViews.ts';
import { landingFor, locksWhenIdle, phoneTabsFor, railFor, railItemAt, refusalAt, URGENT_QUEUES, type Refusal } from './rail.ts';
import { SignOutButton } from './SignOutButton.tsx';
import { StaffAccount } from './StaffAccount.tsx';
import { useIdleLock } from './useIdleLock.ts';
import { NoAlertNumberBanner } from './NoAlertNumberBanner.tsx';

/** Who is at the console and where, for a prompt the route puts across the top of every screen (#317). */
export interface FrameStaff {
  venueId: string;
  permissions: readonly Permission[];
  pathname: string;
  /** The address's search, `?tab=highHands`. */
  search: string;
}

type ReadyStaff = Extract<StaffVenueState, { status: 'ready' }>;

/** The keys the screen open now offers, working while the staff member keeps their shortcuts switch on (WCAG 2.1.4). */
function StaffShortcuts({ venueId, children }: { venueId: string; children: ReactNode }) {
  const isOn = useStaffShortcuts(venueId);
  return <ShortcutProvider isOn={isOn.data ?? true}>{children}</ShortcutProvider>;
}

interface RefusedProps {
  refusal: Refusal;
  /** The address is the Live floor's, `/`. */
  isHome: boolean;
  /** The first screen the role has; none for a role with no screen. */
  landing: ReturnType<typeof landingFor>;
}

/**
 * A screen the role does not include, or one the club does not use (C-04), said so under the screen's own name (#811), with
 * the way to the first screen the role has (audit F-106). The Live floor's address, for a role without it (#640: Service),
 * opens that screen; a role with no screen at all is told so (owner, 8 Nov).
 */
function Refused({ refusal, isHome, landing }: RefusedProps) {
  const navigate = useNavigate();
  const href = landing?.href;
  useEffect(() => {
    if (isHome && href !== undefined) void navigate({ href, replace: true });
  }, [isHome, href, navigate]);
  if (isHome) return href === undefined ? <Screen title={t('console.noScreens.title')} status="empty" emptyText={t('console.noScreens.body')} /> : null;
  const action = landing === undefined ? undefined : { label: landing.label, onClick: () => void navigate({ href: landing.href }) };
  return <Screen title={refusal.title} status="empty" emptyText={t(refusal.isOff ? 'console.switchedOff' : 'console.notAllowed')} emptyAction={action} />;
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
      <StaffShortcuts venueId={staff.venue.venueId}>
        <ToastProvider place="console"><StaffFrame staff={staff} prompt={prompt} onIdle={onIdle}>{children}</StaffFrame></ToastProvider>
      </StaffShortcuts>
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
 * console works there (F1-07, decision 0477), so nobody takes it for the club, with the way back; for those who can set it, that
 * the club has no alert number; and any prompt.
 */
function FrameBanner({ staff, prompt, location }: { staff: ReadyStaff; prompt: StaffFrameProps['prompt']; location: { pathname: string; search: string } }) {
  const { venueId, permissions, isPractice } = staff.venue;
  const { isVenueFrozen } = useControlState(venueId);
  const navigate = useNavigate();
  return (
    <>
      {isVenueFrozen ? <KillSwitchBanner audience="staff" /> : null}
      {isPractice ? (
        <PracticeBanner message={t('console.practiceBanner')} action={{ label: t('console.shell.backToClub'), onPress: () => staff.setPractice(false) }} />
      ) : null}
      {!isPractice && permissions.includes('venue.configure')
        ? <NoAlertNumberBanner venueId={venueId} onAdd={() => void navigate({ href: '/settings?tab=settings&part=club' })} /> : null}
      {prompt?.({ venueId, permissions, ...location })}
    </>
  );
}

interface FrameBodyProps {
  staff: ReadyStaff;
  urgent: Readonly<Record<string, number>> | null;
  /** The screen open now is refused: why, under its name; or undefined. */
  refusal: Refusal | undefined;
  isHome: boolean;
  landing: ReturnType<typeof landingFor>;
  children: ReactNode;
}

/** The screen, or its refusal, with what every screen shares: the staff member's density, the export, the chime. */
function FrameBody({ staff, urgent, refusal, isHome, landing, children }: FrameBodyProps) {
  const { venueId, permissions } = staff.venue;
  const density = useStaffDensity(venueId);
  // Every table offers its export to staff who export tables, each recorded first (#102).
  const recordExport = useRecordTableExport(venueId);
  // Every table keeps its order, search and filters in the address (owner, 9 Nov).
  const views = useAddressTableViews();
  return (
    <DataTableDensityProvider density={density.data ?? 'comfortable'}>
      <DataTableViewProvider store={views}>
      <DataTableExportProvider exporter={permissions.includes('exports.table') ? recordExport : null}>
        {/* New urgent work chimes and is told to a screen reader, and the tab says how much waits (decision 0301); a venue
            switch starts the chime over, so the other venue's counts sound nothing. */}
        <UrgentChime key={venueId} counts={urgent} />
        <TitleCount count={totalOf(urgent)}>
          {/* A screen opened by address that the role doesn't include is refused here, before it loads anything. */}
          {refusal === undefined ? children : <Refused refusal={refusal} isHome={isHome} landing={landing} />}
        </TitleCount>
      </DataTableExportProvider>
      </DataTableViewProvider>
    </DataTableDensityProvider>
  );
}

function StaffFrame({ staff, prompt, onIdle, children }: StaffFrameProps) {
  const { venueId, permissions } = staff.venue;
  const navigate = useNavigate();
  const { pathname, search, counts, urgent, sections, tabs, refusal } = useStaffShell(staff, onIdle);
  // A role with no screen (an investor, a dealer) has nothing to search for, and the name of a screen it does not have is wrong.
  const hasNoScreen = sections.length === 0;
  return (
    <ConsoleShell
      sections={sections}
      tabs={tabs}
      currentItem={railItemAt(pathname)}
      title={hasNoScreen && pathname === '/' ? t('console.noScreens.title') : refusal?.title}
      // The Live floor docks its requests at the screen's edge, so it lays out its own gutter (decision 0482).
      isFullBleed={pathname === '/' && refusal === undefined}
      onNavigate={(href) => void navigate({ href })}
      banner={<FrameBanner staff={staff} prompt={prompt} location={{ pathname, search }} />}
      search={hasNoScreen ? undefined : <ConsoleSearch venueId={venueId} permissions={permissions} sections={sections} />}
      pulse={<FramePulse venueId={venueId} permissions={permissions} counts={counts} />}
      clock={<FrameClock />}
      account={<StaffAccount staff={staff} />}
    >
      <FrameBody staff={staff} urgent={urgent} refusal={refusal} isHome={pathname === '/'} landing={landingFor(sections)}>{children}</FrameBody>
    </ConsoleShell>
  );
}
