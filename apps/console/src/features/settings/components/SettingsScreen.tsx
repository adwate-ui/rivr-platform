import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen } from '@rivr/ui';
import type { ComponentType } from 'react';
import { NOTICE_AREA, type SettingsArea } from './areas.ts';
import { ChipsSection } from './ChipsSection.tsx';
import { NoticesSection } from './NoticesSection.tsx';
import { RulesArea } from './RulesArea.tsx';
import { VenueSection } from './VenueSection.tsx';

/** One area's content: its rules in their groups, the notices, the club's details, or the chips. */
function AreaContent({ area, venueId, isSuperAdmin }: { area: SettingsArea; venueId: string; isSuperAdmin: boolean }) {
  if (area === 'club') return <VenueSection venueId={venueId} />;
  if (area === 'chips') return <ChipsSection venueId={venueId} />;
  if (area === NOTICE_AREA) return <NoticesSection venueId={venueId} />;
  return <RulesArea key={area} venueId={venueId} area={area} isSuperAdmin={isSuperAdmin} />;
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

/** The TVs tab's own settings (redesign RD-18), above its screens, for staff who change settings. */
export function TvRules() {
  const staff = useStaffVenue();
  if (staff.status !== 'ready' || !staff.venue.permissions.includes('settings.manage')) return null;
  const { permissions, venueId } = staff.venue;
  return <RulesArea venueId={venueId} area="tvs" isSuperAdmin={permissions.includes('venue.configure')} />;
}
