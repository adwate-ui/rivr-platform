import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen } from '@rivr/ui';
import { WaitlistLists } from './WaitlistLists.tsx';

/**
 * Lists, the Waitlist's first tab (console v3): a card for each table's own list (decision 0433), for staff with
 * waitlist.manage. The frame holds the tabs (`?tab=lists`, `?tab=interest`, decision 0443).
 */
export function WaitlistScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const { venueId, permissions } = staff.venue;
  const title = t('console.waitlist.title');
  if (!permissions.includes('waitlist.manage')) return <Screen title={title} status="error" errorText={t('console.waitlist.notAllowed')} />;
  return (
    <Screen title={title}>
      <WaitlistLists venueId={venueId} canOpen={permissions.includes('floor.manage')} />
    </Screen>
  );
}
