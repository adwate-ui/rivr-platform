import { useSignOut, type StaffVenueState } from '@rivr/db';
import { t } from '@rivr/i18n';
import { AccountMenu, Switch, type ShortcutHint } from '@rivr/ui';

interface StaffAccountProps {
  staff: Extract<StaffVenueState, { status: 'ready' }>;
  /** The keys that work on the screen open now. */
  shortcuts: readonly ShortcutHint[];
}

/**
 * The staff member's menu at the header's end (console v3): who is signed in, their role and the venue the console works
 * in, the switch to the practice venue for staff at both, the keys that work, and Sign out.
 */
export function StaffAccount({ staff, shortcuts }: StaffAccountProps) {
  const signOut = useSignOut();
  const { venue } = staff;
  const detail = t('console.shell.detail', { role: t(`console.staff.roles.${venue.role}`), venue: venue.venueName });
  return (
    <AccountMenu name={venue.fullName} detail={detail} shortcuts={shortcuts}
      signOut={{ label: t('common.signIn.signOut'), onPress: () => signOut.mutate(), isPending: signOut.isPending }}>
      {staff.canPractise ? <Switch label={t('console.practice')} isOn={venue.isPractice} onChange={staff.setPractice} /> : null}
    </AccountMenu>
  );
}
