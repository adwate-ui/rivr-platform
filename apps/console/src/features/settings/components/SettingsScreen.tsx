import type { Permission } from '@rivr/contracts';
import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack, Tabs } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { HIDDEN_AREAS, NOTICE_AREA, RULE_AREAS, VENUE_AREAS, type SettingsArea } from './areas.ts';
import { ChipsSection } from './ChipsSection.tsx';
import { NoticesSection } from './NoticesSection.tsx';
import { RakeSection } from './RakeSection.tsx';
import { RulesArea } from './RulesArea.tsx';
import { VenueSection } from './VenueSection.tsx';

/** The areas a staff member has: the rules and notices with settings.manage, the club's details as a super admin; none hidden (#626). */
function areasFor(canSet: boolean, isSuperAdmin: boolean): readonly SettingsArea[] {
  const rules: readonly SettingsArea[] = canSet ? [...RULE_AREAS, NOTICE_AREA] : [];
  return [...rules, ...(isSuperAdmin ? VENUE_AREAS : [])].filter((area) => !HIDDEN_AREAS.includes(area));
}

/** One area's content: its rules (in the Rake area, each table type's rake first), the club's details, or the chips. */
function AreaContent({ area, venueId, isSuperAdmin }: { area: SettingsArea; venueId: string; isSuperAdmin: boolean }) {
  if (area === 'club') return <VenueSection venueId={venueId} />;
  if (area === 'chips') return <ChipsSection venueId={venueId} />;
  if (area === NOTICE_AREA) return <NoticesSection venueId={venueId} />;
  const rules = <RulesArea key={area} venueId={venueId} area={area} isSuperAdmin={isSuperAdmin} />;
  return area === 'rake' ? <Stack gap={10}><RakeSection venueId={venueId} />{rules}</Stack> : rules;
}

/** Settings' parts (console v3), each a tab: the rules and the club's details, the TVs and tablets, and the games run. */
export type SettingsPart = 'settings' | 'devices' | 'history';

const PART_HREF: Readonly<Record<SettingsPart, string>> = { settings: '/settings', devices: '/settings?tab=tvs', history: '/settings?tab=history' };

/**
 * The part a tab in the address opens (`?tab=`): a kind of device, or Devices itself, opens Devices; Games history its
 * own; anything else is one of Settings' areas, so `/settings?tab=club` still opens the club's details.
 */
export function partOf(tab: string | undefined): SettingsPart {
  if (tab === 'devices' || tab === 'tvs' || tab === 'tablets') return 'devices';
  return tab === 'history' || tab === 'games-history' ? 'history' : 'settings';
}

/** The parts a staff member has: the rules with settings.manage or venue.configure, Devices with devices.manage, Games history with tables.manage. */
function partsFor(permissions: readonly Permission[]): readonly SettingsPart[] {
  const has = (permission: Permission) => permissions.includes(permission);
  return [
    ...(has('settings.manage') || has('venue.configure') ? (['settings'] as const) : []),
    ...(has('devices.manage') ? (['devices'] as const) : []),
    ...(has('tables.manage') ? (['history'] as const) : []),
  ];
}

interface SettingsScreenProps {
  /** The address's `?tab=`: a part, or a place in one. */
  tab?: string | undefined;
  /** The Devices part, from the devices feature, and Games history, from its own. */
  devices: ReactNode;
  gamesHistory: ReactNode;
}

/**
 * Settings (console v3): its parts as tabs, Settings, Devices and Games history, each shown to the staff who have it; a
 * part asked for that the staff member does not have opens their first. With none, a refusal.
 */
export function SettingsScreen({ tab, devices, gamesHistory }: SettingsScreenProps) {
  const staff = useStaffVenue();
  const navigate = useNavigate();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const parts = partsFor(staff.venue.permissions);
  const asked = partOf(tab);
  const part = parts.includes(asked) ? asked : parts[0];
  if (part === undefined) return <Screen title={t('console.settings.title')} status="error" errorText={t('console.settings.notAllowed')} />;
  const content: Record<SettingsPart, ReactNode> = { settings: <RulesScreen tab={tab} />, devices, history: gamesHistory };
  return (
    <Stack gap={6}>
      {parts.length < 2 ? null : (
        <Tabs look="pill" label={t('console.settings.partsLabel')} current={part} onNavigate={(href) => void navigate({ href })}
          tabs={parts.map((id) => ({ id, label: t(`console.settings.parts.${id}`), href: PART_HREF[id] }))} />
      )}
      {content[part]}
    </Stack>
  );
}

/**
 * Settings' own part (#33, #604), in areas: the rules by what they govern, changed without a release by staff with
 * settings.manage; and for super admins (venue.configure) the club's details and the chips. Cashiers and dealers have
 * neither, so they never see it, and the database refuses them anyway.
 */
function RulesScreen({ tab: named }: { tab: string | undefined }) {
  const staff = useStaffVenue();
  const navigate = useNavigate();
  // Only shown once the venue is known.
  if (staff.status !== 'ready') return null;
  const { permissions, venueId } = staff.venue;
  const canSet = permissions.includes('settings.manage');
  const isSuperAdmin = permissions.includes('venue.configure');
  const areas = areasFor(canSet, isSuperAdmin);
  // Never empty here (Settings shows this part only to staff with one or the other); 'club' only satisfies the type.
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
