import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack } from '@rivr/ui';
import { PrizeWheel } from './PrizeWheel.tsx';
import { WaitingSpins } from './WaitingSpins.tsx';

/**
 * The spin wheel (#150; additions "Spin wheel"; decision 0266; console v3 a tab of Rewards), for staff who run promotions
 * (promotions.manage, decision 0302): the spins waiting, each spun with the member there, then the wheel's prizes, their
 * odds as bars, why any is off the wheel with a link to the spin budget, and a new prize.
 */
export function SpinWheelScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const { permissions, venueId } = staff.venue;
  if (!permissions.includes('promotions.manage')) return <Screen title={t('console.spin.title')} status="error" errorText={t('console.spin.notAllowed')} />;
  return (
    <Screen title={t('console.spin.title')}>
      <Stack gap={6}>
        <WaitingSpins venueId={venueId} />
        <PrizeWheel venueId={venueId} canKeep />
      </Stack>
    </Screen>
  );
}
