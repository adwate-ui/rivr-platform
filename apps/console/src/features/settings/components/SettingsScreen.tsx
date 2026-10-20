import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack } from '@rivr/ui';
import { ChipsSection } from './ChipsSection.tsx';
import { RulesSection } from './RulesSection.tsx';
import { VenueSection } from './VenueSection.tsx';

/**
 * Settings (#33): every effective-dated setting, changed without a release by staff with settings.manage;
 * and for super admins (venue.configure) the venue configuration and the chips. Cashiers and dealers
 * have neither, so they never see it, and the database refuses them anyway.
 */
export function SettingsScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const { permissions, venueId } = staff.venue;
  const canSet = permissions.includes('settings.manage');
  const canConfigure = permissions.includes('venue.configure');
  if (!canSet && !canConfigure) return <Screen title={t('console.settings.title')} status="error" errorText={t('console.settings.notAllowed')} />;
  return (
    <Screen title={t('console.settings.title')}>
      <Stack gap={10}>
        {canSet ? <RulesSection venueId={venueId} /> : null}
        {canConfigure ? <VenueSection venueId={venueId} /> : null}
        {canConfigure ? <ChipsSection venueId={venueId} /> : null}
      </Stack>
    </Screen>
  );
}
