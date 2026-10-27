import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack } from '@rivr/ui';
import { CreatorForm } from './CreatorForm.tsx';
import { CreatorTable } from './CreatorTable.tsx';

/** Creators (#163; scope-v1 "Growth"): each creator's code and link, their sign-ups to KYC, first visit and first buy-in, and what they are owed. */
export function CreatorsScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.creators.title');
  if (!staff.venue.permissions.includes('promotions.manage')) return <Screen title={title} status="error" errorText={t('console.creators.notAllowed')} />;
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <CreatorTable venueId={staff.venue.venueId} />
        <CreatorForm venueId={staff.venue.venueId} />
      </Stack>
    </Screen>
  );
}
