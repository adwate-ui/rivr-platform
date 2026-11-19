import type { Permission } from '@rivr/contracts';
import {
  useAuthStatus, useStaffDensity, useStaffQueueCounts, useStaffShortcuts, useStaffVenue, type StaffVenueState,
} from '@rivr/db';
import { useRecordTableExport } from '@rivr/db/exports';
import { t } from '@rivr/i18n';
import {
  ConsoleShell, DataTableDensityProvider, DataTableExportProvider, DataTableViewProvider, MemberLinksProvider, PracticeBanner, Screen, ShortcutProvider, TitleCount, ToastProvider, UrgentChime,
} from '@rivr/ui';
import { Navigate, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect, useMemo, type ReactNode } from 'react';
import { ConsoleSearch } from './ConsoleSearch.tsx';
import { memberLinksFor } from './memberLinks.ts';
import { FrameClock, FramePulse, runsTheFloor } from './FrameHeader.tsx';
import { NotStaff } from './NotStaff.tsx';
import { useAddressTableViews } from './tableViews.ts';
import { CHIME_ONLY_QUEUES, landingFor, phoneTabsFor, railFor, railItemAt, refusalAt, titleCountOf, URGENT_QUEUES, type Refusal } from './rail.ts';
import { SignOutButton } from './SignOutButton.tsx';
import { StaffAccount } from './StaffAccount.tsx';
import { NoAlertEmailBanner } from './NoAlertEmailBanner.tsx';

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
  return <Screen title={refusal.title} status="empty" emptyText={t('console.notAllowed')} emptyAction={action} />;
}

/**
 * The console's frame for signed-in staff: the rail for their role at the venue the console works in, the header,
 * and the export of every table for staff who export them. Nobody signed in goes to sign-in; a session ends only when
 * the staff member signs out (the owner, 15 Nov; decision 0660). Someone who is not staff can only sign out. `prompt` is what waits for the
 * staff member, across the top of every screen.
 */
export function Frame({ children, prompt }: { children: ReactNode; prompt?: (staff: FrameStaff) => ReactNode }) {
  const authStatus = useAuthStatus();
  const staff = useStaffVenue();
  if (authStatus === 'signed-out') return <Navigate to="/sign-in" replace />;
  if (staff.status === 'not-staff') return <NotStaff />;
  if (staff.status === 'ready') {
    // The keys the screen open now offers (useShortcut), and the menu's list of them; and the toasts every step raises,
    // with Undo where the step has its own compensating call (console v3).
    return (
      <StaffShortcuts venueId={staff.venue.venueId}>
        <ToastProvider place="console"><StaffFrame staff={staff} prompt={prompt}>{children}</StaffFrame></ToastProvider>
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
  children: ReactNode;
}

/** The rail's counts, and the urgent queues' own: null until the first read, so the first read sounds nothing. */
function useRailCounts(venueId: string) {
  // Every queue the staff member acts on (decision 0301).
  const queues = useStaffQueueCounts(venueId);
  const data = queues.data;
  const urgent = data === undefined ? null : Object.fromEntries(URGENT_QUEUES.map((queue) => [queue, data[queue] ?? 0]));
  return { counts: { ...data }, urgent };
}

/** The screen open now: its address, the tab named in it, and the whole search for a prompt. */
function useLocation() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const search = useRouterState({ select: (state) => state.location.searchStr });
  return { pathname, search, tab: new URLSearchParams(search).get('tab') ?? undefined };
}

/** Where the staff member is and what waits for them: the rail and tabs with their counts, and any refusal. */
function useStaffShell(staff: ReadyStaff) {
  const { venueId, permissions } = staff.venue;
  const location = useLocation();
  const { counts, urgent } = useRailCounts(venueId);
  return {
    ...location, counts, urgent, sections: railFor(permissions, counts), tabs: phoneTabsFor(permissions, counts),
    refusal: refusalAt(permissions, location.pathname, location.tab),
  };
}

/**
 * Across the top, above everything: the practice venue's stripe on every screen while the
 * console works there (F1-07, decision 0477), so nobody takes it for the club, with the way back; for those who can set it, that
 * the club has no alert number; and any prompt.
 */
function FrameBanner({ staff, prompt, location }: { staff: ReadyStaff; prompt: StaffFrameProps['prompt']; location: { pathname: string; search: string } }) {
  const { venueId, permissions, isPractice } = staff.venue;
  const navigate = useNavigate();
  return (
    <>
      {isPractice ? (
        <PracticeBanner message={t('console.practiceBanner')} action={{ label: t('console.shell.backToClub'), onPress: () => staff.setPractice(false) }} />
      ) : null}
      {!isPractice && permissions.includes('venue.configure')
        ? <NoAlertEmailBanner venueId={venueId} onAdd={() => void navigate({ href: '/settings?tab=club' })} /> : null}
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
  // Every member's name opens their account on Members, for staff who open it (owner, 19 Nov).
  const navigate = useNavigate();
  const memberLinks = useMemo(() => memberLinksFor(permissions, (href) => void navigate({ href })), [permissions, navigate]);
  return (
    <MemberLinksProvider links={memberLinks}>
    <DataTableDensityProvider density={density.data ?? 'comfortable'}>
      <DataTableViewProvider store={views}>
      <DataTableExportProvider exporter={permissions.includes('exports.table') ? recordExport : null}>
        {/* New urgent work chimes and is told to a screen reader, and the tab says how much waits (decision 0301); a venue
            switch starts the chime over, so the other venue's counts sound nothing. */}
        <UrgentChime key={venueId} counts={urgent} chimeOnly={CHIME_ONLY_QUEUES} />
        <TitleCount count={titleCountOf(urgent)}>
          {/* A screen opened by address that the role doesn't include is refused here, before it loads anything. */}
          {refusal === undefined ? children : <Refused refusal={refusal} isHome={isHome} landing={landing} />}
        </TitleCount>
      </DataTableExportProvider>
      </DataTableViewProvider>
    </DataTableDensityProvider>
    </MemberLinksProvider>
  );
}

function StaffFrame({ staff, prompt, children }: StaffFrameProps) {
  const { venueId, permissions } = staff.venue;
  const navigate = useNavigate();
  const { pathname, search, counts, urgent, sections, tabs, refusal } = useStaffShell(staff);
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
      pulse={runsTheFloor(permissions) ? <FramePulse venueId={venueId} permissions={permissions} counts={counts} /> : undefined}
      clock={<FrameClock />}
      account={<StaffAccount staff={staff} />}
    >
      <FrameBody staff={staff} urgent={urgent} refusal={refusal} isHome={pathname === '/'} landing={landingFor(sections)}>{children}</FrameBody>
    </ConsoleShell>
  );
}
