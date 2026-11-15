import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen } from '@rivr/ui';
import { AddToList, WaitlistLists } from './WaitlistLists.tsx';

/**
 * Lists, the Waitlist's first tab (console v3; redesign RD-31): every place as one table, each on its own table's list
 * (decision 0467), and Add to a list in the title row, for staff with waitlist.manage. The frame holds the tabs (`?tab=lists`, `?tab=interest`, decision 0476).
 */
export function WaitlistScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const { venueId, permissions } = staff.venue;
  const title = t('console.waitlist.title');
  if (!permissions.includes('waitlist.manage')) return <Screen title={title} status="error" errorText={t('console.waitlist.notAllowed')} />;
  return (
    <Screen title={title} actions={<AddToList venueId={venueId} />}>
      <WaitlistLists venueId={venueId} canOpen={permissions.includes('floor.manage')} canCheckId={permissions.includes('kyc.in_person') || permissions.includes('kyc.review')} />
    </Screen>
  );
}
