import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack } from '@rivr/ui';
import type { ComponentType } from 'react';
import { NOTICE_AREA, type SettingsArea } from './areas.ts';
import { ChipsSection } from './ChipsSection.tsx';
import { NoticesSection } from './NoticesSection.tsx';
import { RakeSection } from './RakeSection.tsx';
import { RulesArea } from './RulesArea.tsx';
import { VenueSection } from './VenueSection.tsx';

/** One area's content: its rules (in the Rake area, each table type's rake first), the club's details, or the chips. */
function AreaContent({ area, venueId, isSuperAdmin }: { area: SettingsArea; venueId: string; isSuperAdmin: boolean }) {
  if (area === 'club') return <VenueSection venueId={venueId} />;
  if (area === 'chips') return <ChipsSection venueId={venueId} />;
  if (area === NOTICE_AREA) return <NoticesSection venueId={venueId} />;
  const rules = <RulesArea key={area} venueId={venueId} area={area} isSuperAdmin={isSuperAdmin} />;
  return area === 'rake' ? <Stack gap={10}><RakeSection venueId={venueId} />{rules}</Stack> : rules;
}

/** One tab of Settings: an area of rules changed without a release, the notices, or the club's details. */
function AreaScreen({ area }: { area: SettingsArea }) {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const { permissions, venueId } = staff.venue;
  return (
    <Screen title={t(`console.settings.areas.${area}`)}>
      <AreaContent area={area} venueId={venueId} isSuperAdmin={permissions.includes('venue.configure')} />
    </Screen>
  );
}

/**
 * Settings' tabs (#33, #604), each area by the rail's own list of who may open it: the rules by what they govern and the
 * notices for staff with settings.manage, the club's details for super admins (venue.configure). The route adds the devices.
 */
export const SETTINGS_PANES: Readonly<Record<string, ComponentType>> = {
  floor: () => <AreaScreen area="floor" />,
  members: () => <AreaScreen area="members" />,
  notices: () => <AreaScreen area="notices" />,
  club: () => <AreaScreen area="club" />,
};
