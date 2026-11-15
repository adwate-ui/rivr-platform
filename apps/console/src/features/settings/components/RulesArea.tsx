import { useVenueSettings, type VenueSetting } from '@rivr/db';
import { formatDayTime, formatNumber, t } from '@rivr/i18n';
import { LoadState, SettingsGroups, Sheet, type SettingsRow } from '@rivr/ui';
import { useState } from 'react';
import { AREA_GROUPS, keysOf, type GroupedArea } from './groups.ts';
import { SettingPanel } from './SettingPanel.tsx';
import { defaultOf, isSuperAdminOnly, settingHelp, settingName, valueText } from './settingsCopy.ts';

type TierName = (id: string) => string;

/** The value now, in words, for the venue; for a table type, tier or stake, how many have one. */
function nowText(setting: VenueSetting, tierName: TierName): string {
  if (setting.scope === 'venue') {
    const inForce = setting.subjects[0]?.inForce ?? null;
    if (inForce !== null) return valueText(setting.key, setting.fields, inForce.value, tierName);
    const fallback = defaultOf(setting.key);
    return fallback === undefined ? t('console.settings.notSet') : t('console.settings.byDefault', { value: valueText(setting.key, setting.fields, fallback, tierName) });
  }
  const set = setting.subjects.filter((subject) => subject.inForce !== null).length;
  return set === 1 ? t(`console.settings.setForOne.${setting.scope}`) : t(`console.settings.setFor.${setting.scope}`, { count: formatNumber(set) });
}

/** The changes to come, soonest first, in words: "From 16 Nov, 18:00: 12 minutes"; a dash for none. */
function toComeText(setting: VenueSetting, tierName: TierName): string {
  const changes = setting.subjects.flatMap((rules) => rules.scheduled.map((entry) => ({ entry, label: rules.label })))
    .sort((a, b) => (a.entry.effectiveFrom ?? '').localeCompare(b.entry.effectiveFrom ?? ''));
  if (changes.length === 0) return t('console.settings.none');
  return changes.map(({ entry, label }) => {
    const value = valueText(setting.key, setting.fields, entry.value, tierName);
    const date = entry.effectiveFrom === null ? '' : formatDayTime(new Date(entry.effectiveFrom));
    // A scoped setting's change says what it is for: "Black card Weight: 3".
    return t('console.settings.fromEntry', { date, value: label === '' ? value : `${label} ${value}` });
  }).join(t('console.settings.fieldSeparator'));
}

interface RowFor {
  tierName: TierName;
  /** A super admin, who changes the settings only a super admin may. */
  isSuperAdmin: boolean;
  onChange: (key: string) => void;
}

/** A setting as its group lists it; Change only where the staff member may change it. */
function rowOf(setting: VenueSetting, { tierName, isSuperAdmin, onChange }: RowFor): SettingsRow {
  const isLocked = isSuperAdminOnly(setting.key) && !isSuperAdmin;
  return {
    key: setting.key, name: settingName(setting.key), line: settingHelp(setting.key, setting.description), now: nowText(setting, tierName),
    who: t(isSuperAdminOnly(setting.key) ? 'console.settings.superAdminOnly' : 'console.settings.managers'),
    toCome: toComeText(setting, tierName), onChange: isLocked ? undefined : () => onChange(setting.key),
  };
}

/**
 * One tab's settings in their groups (redesign RD-18): each with its one line, its value now, who changes it and the
 * changes to come. Change opens the setting's panel on the right: a new value from now or a day and time to come, never
 * backwards, then what is in force, to come and before.
 */
export function RulesArea({ venueId, area, isSuperAdmin }: { venueId: string; area: GroupedArea; isSuperAdmin: boolean }) {
  const settings = useVenueSettings(venueId);
  const [changingKey, setChangingKey] = useState<string | null>(null);
  // A failed refresh keeps what was known.
  if (settings.data === undefined) return <LoadState isError={settings.isError} errorText={t('console.settings.loadFailed')} onRetry={() => void settings.refetch()} />;
  const { tiers } = settings.data;
  const rowFor = { tierName: (id: string) => tiers.find((tier) => tier.subject === id)?.label ?? id, isSuperAdmin, onChange: setChangingKey };
  const { settings: all } = settings.data;
  const groups = AREA_GROUPS[area].map((group) => ({
    heading: t(`console.settings.groups.${group}`),
    settings: keysOf(group).flatMap((key) => all.filter((setting) => setting.key === key).map((setting) => rowOf(setting, rowFor))),
  }));
  const changing = all.find((setting) => setting.key === changingKey);
  return (
    <>
      <SettingsGroups label={t('console.settings.title')} searchLabel={t('console.settings.filter')} groups={groups} />
      {changing === undefined ? null : (
        <Sheet place="console" isOpen onClose={() => setChangingKey(null)} title={settingName(changing.key)}>
          <SettingPanel key={changing.key} venueId={venueId} setting={changing} tiers={tiers} />
        </Sheet>
      )}
    </>
  );
}
