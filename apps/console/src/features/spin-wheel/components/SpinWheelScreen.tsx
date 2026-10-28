import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack } from '@rivr/ui';
import { PrizeForm } from './PrizeForm.tsx';
import { PrizeTable } from './PrizeTable.tsx';
import { WaitingSpins } from './WaitingSpins.tsx';

/**
 * The spin wheel (#150; additions "Spin wheel"; decision 0266): the floor (floor.manage) spins the wheel for each
 * member a promotion gave a spin; staff who run promotions keep its prizes and their odds.
 */
export function SpinWheelScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const { permissions, venueId } = staff.venue;
  const canSpin = permissions.includes('floor.manage');
  const canKeepPrizes = permissions.includes('promotions.manage');
  if (!canSpin && !canKeepPrizes) return <Screen title={t('console.spin.title')} status="error" errorText={t('console.spin.notAllowed')} />;
  return (
    <Screen title={t('console.spin.title')}>
      <Stack gap={8}>
        {canSpin ? <WaitingSpins venueId={venueId} /> : null}
        <PrizeTable venueId={venueId} canRemove={canKeepPrizes} />
        {canKeepPrizes ? <PrizeForm venueId={venueId} /> : null}
      </Stack>
    </Screen>
  );
}
