import { useVenueSettings, type SettingEntry, type SettingValue, type VenueSetting } from '@rivr/db';
import { formatDayTime, formatDuration, formatNumber, t } from '@rivr/i18n';
import { LoadState, SettingsGroups, type SettingsRow, type SettingsValue } from '@rivr/ui';
import { useState } from 'react';
import { AREA_GROUPS, keysOf, type GroupedArea } from './groups.ts';
import { offeredSubjects } from './SettingHistory.tsx';
import { SettingSheet } from './SettingSheet.tsx';
import { defaultOf, isSuperAdminOnly, settingHelp, settingName, valueText } from './settingsCopy.ts';

type TierName = (id: string) => string;

/** A stake's value in one word or two: its call time in the short form, `3 h`; anything else as the setting writes it. */
function stakeText(setting: VenueSetting, value: SettingValue, tierName: TierName): string {
  const minutes = setting.key === 'call_time.minutes' ? value['minutes'] : undefined;
  return typeof minutes === 'number' ? formatDuration(minutes * 60) : valueText(setting.key, setting.fields, value, tierName);
}

/**
 * The value now, in words, for the venue; a line for each stake the club has today, with its name (RD-19); for a tier or
 * a role, how many have one.
 */
function nowValue(setting: VenueSetting, tierName: TierName): SettingsValue {
  if (setting.scope === 'venue') {
    const inForce = setting.subjects[0]?.inForce ?? null;
    if (inForce !== null) return valueText(setting.key, setting.fields, inForce.value, tierName);
    const fallback = defaultOf(setting.key);
    return fallback === undefined ? t('console.settings.notSet') : t('console.settings.byDefault', { value: valueText(setting.key, setting.fields, fallback, tierName) });
  }
  if (setting.scope === 'table_type') {
    const stakes = offeredSubjects(setting).flatMap((rules) => (rules.inForce === null ? [] : [`${rules.label} ${stakeText(setting, rules.inForce.value, tierName)}`]));
    return stakes.length === 0 ? t('console.settings.notSet') : stakes;
  }
  const set = setting.subjects.filter((subject) => subject.inForce !== null).length;
  return set === 1 ? t(`console.settings.setForOne.${setting.scope}`) : t(`console.settings.setFor.${setting.scope}`, { count: formatNumber(set) });
}

const dayTime = (entry: SettingEntry) => (entry.effectiveFrom === null ? '' : formatDayTime(new Date(entry.effectiveFrom)));

/**
 * The changes to come, soonest first, in words, or a dash for none: for the venue "From Mon 16 Nov, 18:00: 12 minutes";
 * for a scoped setting each moment on a line, then a line for each subject changing then.
 */
function toComeValue(setting: VenueSetting, tierName: TierName): SettingsValue {
  const changes = offeredSubjects(setting).flatMap((rules) => rules.scheduled.map((entry) => ({ entry, label: rules.label })))
    .sort((a, b) => (a.entry.effectiveFrom ?? '').localeCompare(b.entry.effectiveFrom ?? ''));
  if (changes.length === 0) return t('console.settings.none');
  if (setting.scope === 'venue') {
    return changes.map(({ entry }) => t('console.settings.fromEntry', { date: dayTime(entry), value: stakeText(setting, entry.value, tierName) })).join(t('console.settings.fieldSeparator'));
  }
  return changes.flatMap(({ entry, label }, at) => {
    const line = `${label} ${stakeText(setting, entry.value, tierName)}`;
    const isNewMoment = changes[at - 1]?.entry.effectiveFrom !== entry.effectiveFrom;
    return isNewMoment ? [t('console.settings.fromMoment', { date: dayTime(entry) }), line] : [line];
  });
}

interface RowFor {
  tierName: TierName;
  /** A super admin, who changes the settings only a super admin may. */
  isSuperAdmin: boolean;
  onOpen: (key: string) => void;
}

/** Whether the staff member only reads the setting: a super admin's, seen by anyone else. */
const isLocked = (setting: VenueSetting, isSuperAdmin: boolean) => isSuperAdminOnly(setting.key) && !isSuperAdmin;

/** A setting as its group lists it: Change where the staff member may change it, else History. */
function rowOf(setting: VenueSetting, { tierName, isSuperAdmin, onOpen }: RowFor): SettingsRow {
  const open = () => onOpen(setting.key);
  return {
    key: setting.key, name: settingName(setting.key), line: settingHelp(setting.key, setting.description), now: nowValue(setting, tierName),
    who: t(isSuperAdminOnly(setting.key) ? 'console.settings.superAdminOnly' : 'console.settings.managers'),
    toCome: toComeValue(setting, tierName), ...(isLocked(setting, isSuperAdmin) ? { onHistory: open } : { onChange: open }),
  };
}

/**
 * One tab's settings in their groups (redesign RD-18): each with its one line, its value now, who changes it and the
 * changes to come. A row opens the setting's panel on the right: Change, a new value from now or a day and time to come,
 * never backwards, then what is in force, to come and before; History, the same to read, for a setting the staff member
 * may not change.
 */
export function RulesArea({ venueId, area, isSuperAdmin }: { venueId: string; area: GroupedArea; isSuperAdmin: boolean }) {
  const settings = useVenueSettings(venueId);
  const [openKey, setOpenKey] = useState<string | null>(null);
  // A failed refresh keeps what was known.
  if (settings.data === undefined) return <LoadState isError={settings.isError} errorText={t('console.settings.loadFailed')} onRetry={() => void settings.refetch()} />;
  const { tiers, settings: all } = settings.data;
  const rowFor = { tierName: (id: string) => tiers.find((tier) => tier.subject === id)?.label ?? id, isSuperAdmin, onOpen: setOpenKey };
  const groups = AREA_GROUPS[area].map((group) => ({
    heading: t(`console.settings.groups.${group}`),
    settings: keysOf(group).flatMap((key) => all.filter((setting) => setting.key === key).map((setting) => rowOf(setting, rowFor))),
  }));
  const open = all.find((setting) => setting.key === openKey);
  return (
    <>
      <SettingsGroups label={t('console.settings.title')} searchLabel={t('console.settings.filter')} groups={groups} />
      {open === undefined ? null : (
        <SettingSheet key={open.key} venueId={venueId} setting={open} tiers={tiers} isReadOnly={isLocked(open, isSuperAdmin)} onClose={() => setOpenKey(null)} />
      )}
    </>
  );
}
