import {
  DENSITIES, useSetStaffDensity, useSetStaffShortcuts, useSignOut, useStaffDensity, useStaffShortcuts, type Density, type StaffVenueState,
} from '@rivr/db';
import { t } from '@rivr/i18n';
import { AccountMenu, AccountMenuRow, Segmented, Switch, useShortcutList, useShortcutsOn, type ShortcutHint } from '@rivr/ui';

type ReadyStaff = Extract<StaffVenueState, { status: 'ready' }>;

/** The density the staff member chose, kept in the database (decision 0475): comfortable or compact rows. */
function DensityRow({ venueId }: { venueId: string }) {
  const density = useStaffDensity(venueId);
  const setDensity = useSetStaffDensity();
  const options = DENSITIES.map((value) => ({ value, label: t(`console.shell.${value}`) }));
  return (
    <AccountMenuRow label={t('console.shell.density')}>
      <Segmented<Density> label={t('console.shell.density')} size="small" options={options} value={density.data ?? 'comfortable'}
        onChange={(value) => setDensity.mutate(value)} />
    </AccountMenuRow>
  );
}

/** The staff member's switch for single-key shortcuts, kept like their density; on until they turn it off (WCAG 2.1.4). */
function ShortcutsRow({ venueId }: { venueId: string }) {
  const isOn = useStaffShortcuts(venueId);
  const setOn = useSetStaffShortcuts();
  return <Switch label={t('console.shell.shortcuts')} isOn={isOn.data ?? true} onChange={(value) => setOn.mutate(value)} />;
}

/** The keys that work: `/` while single-key shortcuts are on, Ctrl K always, the screen's own keys, and Escape. */
function useShortcuts(): readonly ShortcutHint[] {
  const offered = useShortcutList();
  const isOn = useShortcutsOn();
  return [
    ...(isOn ? [{ keys: t('console.shell.keys.slash'), label: t('console.shell.keys.search') }] : []),
    { keys: t('console.shell.keys.commandK'), label: t('console.shell.keys.search') },
    ...offered,
    { keys: t('console.shell.keys.escape'), label: t('console.shell.keys.close') },
  ];
}

/**
 * The staff member's menu at the header's end (console v3): who is signed in, their role and the venue the console works
 * in, their density, their keyboard shortcuts switch, the switch to the practice venue for staff at both, the keys that
 * work, and Sign out.
 */
export function StaffAccount({ staff }: { staff: ReadyStaff }) {
  const signOut = useSignOut();
  const shortcuts = useShortcuts();
  const { venue } = staff;
  const detail = t('console.shell.detail', { role: t(`console.staff.roles.${venue.role}`), venue: venue.venueName });
  return (
    <AccountMenu name={venue.fullName} detail={detail} shortcuts={shortcuts}
      signOut={{ label: t('common.signIn.signOut'), onPress: () => signOut.mutate(), isPending: signOut.isPending }}>
      <DensityRow venueId={venue.venueId} />
      <ShortcutsRow venueId={venue.venueId} />
      {staff.canPractise ? <Switch label={t('console.practice')} isOn={venue.isPractice} onChange={staff.setPractice} /> : null}
    </AccountMenu>
  );
}
