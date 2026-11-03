import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen } from '@rivr/ui';
import { RedemptionList } from './RedemptionList.tsx';

/**
 * The Door's Hand over tab (console v3, the coordinator's ruling for the owner): members' redemptions to hand over, for
 * staff with rewards.hand_over, so a host, who has no Marketing (decision 0476), still hands them over at the door.
 */
export function HandOverScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  return (
    <Screen title={t('console.rewards.tabs.handover')}>
      <RedemptionList venueId={staff.venue.venueId} />
    </Screen>
  );
}
