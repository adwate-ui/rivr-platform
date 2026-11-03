import { Stack } from '@rivr/ui';
import { PrizeWheel } from './PrizeWheel.tsx';
import { WaitingSpins } from './WaitingSpins.tsx';

/**
 * The spin wheel (#150; additions "Spin wheel"; decision 0266; console v3 a tab of Rewards), for staff who run promotions
 * (promotions.manage, decision 0302): the spins waiting, each spun with the member there, then the wheel's prizes, their
 * odds, why any is off the wheel, and a new prize.
 */
export function SpinTab({ venueId }: { venueId: string }) {
  return (
    <Stack gap={6}>
      <WaitingSpins venueId={venueId} />
      <PrizeWheel venueId={venueId} canKeep />
    </Stack>
  );
}
