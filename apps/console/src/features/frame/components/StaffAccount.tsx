import { DENSITIES, useSetStaffDensity, useSignOut, useStaffDensity, type Density, type StaffVenueState } from '@rivr/db';
import { t } from '@rivr/i18n';
import { AccountMenu, AccountMenuRow, Segmented, Switch, useShortcutList, type ShortcutHint } from '@rivr/ui';

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

/** The keys that always work, then those the screen open now offers. */
function useShortcuts(): readonly ShortcutHint[] {
  const offered = useShortcutList();
  return [
    { keys: t('console.shell.keys.slash'), label: t('console.shell.keys.search') },
    { keys: t('console.shell.keys.commandK'), label: t('console.shell.keys.search') },
    ...offered,
    { keys: t('console.shell.keys.escape'), label: t('console.shell.keys.close') },
  ];
}

/**
 * The staff member's menu at the header's end (console v3): who is signed in, their role and the venue the console works
 * in, their density, the switch to the practice venue for staff at both, the keys that work, and Sign out.
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
      {staff.canPractise ? <Switch label={t('console.practice')} isOn={venue.isPractice} onChange={staff.setPractice} /> : null}
    </AccountMenu>
  );
}
