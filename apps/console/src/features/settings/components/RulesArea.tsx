import { useVenueSettings, type VenueSetting } from '@rivr/db';
import { formatNumber, t } from '@rivr/i18n';
import { Button, DataTable, SplitView, Stack, Text, type DataTableColumn, type DataTableState } from '@rivr/ui';
import { useState } from 'react';
import { areaOf, isShownSetting, type RuleArea } from './areas.ts';
import { shownInBonusChips } from './bonusChips.ts';
import { SettingChange } from './SettingChange.tsx';
import { SettingPanel } from './SettingPanel.tsx';
import { defaultOf, isSuperAdminOnly, settingHelp, settingName, valueText } from './settingsCopy.ts';

const toCome = (setting: VenueSetting) => setting.subjects.reduce((count, subject) => count + subject.scheduled.length, 0);

/** The value now, in words, for the venue; for a table type, tier or stake, how many have one. */
function nowText(setting: VenueSetting, tierName: (id: string) => string): string {
  if (setting.scope === 'venue') {
    const inForce = setting.subjects[0]?.inForce ?? null;
    if (inForce !== null) return valueText(setting.key, setting.fields, inForce.value, tierName);
    const fallback = defaultOf(setting.key);
    return fallback === undefined ? t('console.settings.notSet') : t('console.settings.byDefault', { value: valueText(setting.key, setting.fields, fallback, tierName) });
  }
  const set = setting.subjects.filter((subject) => subject.inForce !== null).length;
  return set === 1 ? t(`console.settings.setForOne.${setting.scope}`) : t(`console.settings.setFor.${setting.scope}`, { count: formatNumber(set) });
}

/** The area's settings, or loading, or why they could not be read. A failed refresh keeps what was known. */
function tableState(settings: ReturnType<typeof useVenueSettings>, area: RuleArea): DataTableState<VenueSetting> {
  if (settings.data !== undefined) {
    const rows = settings.data.settings.filter((setting) => areaOf(setting.key) === area && isShownSetting(setting.key)).map(shownInBonusChips);
    return { rows, emptyText: t('console.settings.empty') };
  }
  if (settings.isError) return { status: 'error', errorText: t('console.settings.loadFailed'), onRetry: () => void settings.refetch() };
  return { status: 'loading' };
}

interface ColumnsFor {
  tierName: (id: string) => string;
  /** Whether the staff member may change a setting: a super admin's only by a super admin. */
  canChange: (setting: VenueSetting) => boolean;
  /** The setting whose change is open in its row. */
  changingKey: string | null;
  onChange: (setting: VenueSetting) => void;
}

/** The list's columns: name, value now, who changes it and the changes to come, then Change where the staff member may. */
function columnsFor({ tierName, canChange, changingKey, onChange }: ColumnsFor): readonly DataTableColumn<VenueSetting>[] {
  return [
    { key: 'name', header: t('console.settings.keyColumn'), cell: (setting) => settingName(setting.key), sortValue: (setting) => settingName(setting.key) },
    { key: 'now', header: t('console.settings.nowColumn'), cell: (setting) => nowText(setting, tierName) },
    { key: 'who', header: t('console.settings.whoColumn'), cell: (setting) => t(isSuperAdminOnly(setting.key) ? 'console.settings.superAdminOnly' : 'console.settings.managers'), filter: 'choice' },
    { key: 'toCome', header: t('console.settings.toComeColumn'), align: 'end', sortValue: toCome,
      cell: (setting) => (toCome(setting) === 0 ? t('console.settings.noneToCome') : formatNumber(toCome(setting))) },
    {
      key: 'change', header: '', align: 'end',
      cell: (setting) => (canChange(setting) ? (
        <Button variant="subtle" size="small" aria-label={t('console.settings.changeName', { name: settingName(setting.key) })}
          aria-expanded={changingKey === setting.key} onClick={() => onChange(setting)}>
          {t('console.settings.change')}
        </Button>
      ) : null),
    },
  ];
}

/**
 * One area's settings (#604): each by name, its value now, who changes it and the changes to come. Change opens a new
 * value in the setting's row (console v3); opening the setting shows its history beside the list from 1180 px, and in
 * its place below. One or the other is open at a time.
 */
export function RulesArea({ venueId, area, isSuperAdmin }: { venueId: string; area: RuleArea; isSuperAdmin: boolean }) {
  const settings = useVenueSettings(venueId);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [changingKey, setChangingKey] = useState<string | null>(null);
  const tiers = settings.data?.tiers ?? [];
  const columns = columnsFor({
    tierName: (id) => tiers.find((tier) => tier.subject === id)?.label ?? id,
    canChange: (setting) => isSuperAdmin || !isSuperAdminOnly(setting.key),
    changingKey,
    onChange: (setting) => { setOpenKey(null); setChangingKey(changingKey === setting.key ? null : setting.key); },
  });
  const found = settings.data?.settings.find((setting) => setting.key === openKey);
  const open = found === undefined ? undefined : shownInBonusChips(found);
  const list = (
    <Stack gap={4}>
      <Text tone="muted">{t('console.settings.rulesHint')}</Text>
      <DataTable label={t('console.settings.table')} narrowLayout="scroll" columns={columns} rowKey={(setting) => setting.key} {...tableState(settings, area)}
        filter={{ label: t('console.settings.filter'), text: (setting) => `${settingName(setting.key)} ${settingHelp(setting.key, setting.description)}` }}
        onRowOpen={(setting) => { setChangingKey(null); setOpenKey(setting.key); }}
        rowDetail={(setting) => (setting.key === changingKey ? <SettingChange key={setting.key} venueId={venueId} setting={setting} tiers={tiers} /> : null)} />
    </Stack>
  );
  const detail = open === undefined ? null : <SettingPanel key={open.key} venueId={venueId} setting={open} tiers={tiers} isSuperAdmin={isSuperAdmin} />;
  return (
    <SplitView list={list} detail={detail} backLabel={t('console.settings.backTo', { area: t(`console.settings.areas.${area}`) })}
      onBack={() => setOpenKey(null)} />
  );
}
