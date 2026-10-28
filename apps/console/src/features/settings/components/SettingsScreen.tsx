import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack, Tabs } from '@rivr/ui';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { RULE_AREAS, VENUE_AREAS, type SettingsArea } from './areas.ts';
import { ChipsSection } from './ChipsSection.tsx';
import { RakeSection } from './RakeSection.tsx';
import { RulesArea } from './RulesArea.tsx';
import { VenueSection } from './VenueSection.tsx';

/** The areas a staff member has: the rules with settings.manage, the club's details and chips as a super admin. */
function areasFor(canSet: boolean, isSuperAdmin: boolean): readonly SettingsArea[] {
  return [...(canSet ? RULE_AREAS : []), ...(isSuperAdmin ? VENUE_AREAS : [])];
}

/** One area's content: its rules (in the Rake area, each table type's rake first), the club's details, or the chips. */
function AreaContent({ area, venueId, isSuperAdmin }: { area: SettingsArea; venueId: string; isSuperAdmin: boolean }) {
  if (area === 'club') return <VenueSection venueId={venueId} />;
  if (area === 'chips') return <ChipsSection venueId={venueId} />;
  const rules = <RulesArea key={area} venueId={venueId} area={area} isSuperAdmin={isSuperAdmin} />;
  return area === 'rake' ? <Stack gap={10}><RakeSection venueId={venueId} />{rules}</Stack> : rules;
}

/**
 * Settings (#33, #604), in areas: the rules by what they govern, changed without a release by staff with
 * settings.manage; and for super admins (venue.configure) the club's details and the chips. Cashiers and dealers have
 * neither, so they never see it, and the database refuses them anyway.
 */
export function SettingsScreen() {
  const staff = useStaffVenue();
  const navigate = useNavigate();
  // The area is in the address (`?tab=club`), so a refresh, Back or a shared link opens it.
  const { tab: named } = useSearch({ from: '/frame/settings' });
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const { permissions, venueId } = staff.venue;
  const canSet = permissions.includes('settings.manage');
  const isSuperAdmin = permissions.includes('venue.configure');
  if (!canSet && !isSuperAdmin) return <Screen title={t('console.settings.title')} status="error" errorText={t('console.settings.notAllowed')} />;
  const areas = areasFor(canSet, isSuperAdmin);
  // Never empty here (one with neither returned above); 'club' only satisfies the type.
  const area = areas.find((one) => one === named) ?? areas[0] ?? 'club';
  const tabs = areas.map((id) => ({ id, label: t(`console.settings.areas.${id}`), href: `/settings?tab=${id}` }));
  return (
    <Screen title={t('console.settings.title')}>
      <Stack gap={6}>
        <Tabs label={t('console.settings.areasLabel')} tabs={tabs} current={area} onNavigate={(href) => void navigate({ href })} />
        <AreaContent area={area} venueId={venueId} isSuperAdmin={isSuperAdmin} />
      </Stack>
    </Screen>
  );
}
