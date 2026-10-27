import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack } from '@rivr/ui';
import { EventForm } from './EventForm.tsx';
import { EventTable } from './EventTable.tsx';

/** The events calendar (#143; scope-v1 module 7): pro nights and corporate tables, with how many have booked, and adding one. */
export function EventsScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.events.title');
  if (!staff.venue.permissions.includes('promotions.manage')) return <Screen title={title} status="error" errorText={t('console.events.notAllowed')} />;
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <EventTable venueId={staff.venue.venueId} />
        <EventForm venueId={staff.venue.venueId} />
      </Stack>
    </Screen>
  );
}
