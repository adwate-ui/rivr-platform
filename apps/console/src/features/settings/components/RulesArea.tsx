import { useVenueSettings, type VenueSetting } from '@rivr/db';
import { formatNumber, t } from '@rivr/i18n';
import { DataTable, SplitView, Stack, Text, type DataTableColumn, type DataTableState } from '@rivr/ui';
import { useState } from 'react';
import { areaOf, isShownSetting, type RuleArea } from './areas.ts';
import { SettingPanel } from './SettingPanel.tsx';
import { isSuperAdminOnly, settingHelp, settingName, valueText } from './settingsCopy.ts';

const toCome = (setting: VenueSetting) => setting.subjects.reduce((count, subject) => count + subject.scheduled.length, 0);

/** The value now, in words, for the venue; for a table type, tier or stake, how many have one. */
function nowText(setting: VenueSetting, tierName: (id: string) => string): string {
  if (setting.scope === 'venue') {
    const inForce = setting.subjects[0]?.inForce ?? null;
    return inForce === null ? t('console.settings.notSet') : valueText(setting.key, setting.fields, inForce.value, tierName);
  }
  const set = setting.subjects.filter((subject) => subject.inForce !== null).length;
  return t(`console.settings.setFor.${setting.scope}`, { count: formatNumber(set) });
}

/** The area's settings, or loading, or why they could not be read. A failed refresh keeps what was known. */
function tableState(settings: ReturnType<typeof useVenueSettings>, area: RuleArea): DataTableState<VenueSetting> {
  if (settings.data !== undefined) {
    return { rows: settings.data.settings.filter((setting) => areaOf(setting.key) === area && isShownSetting(setting.key)), emptyText: t('console.settings.empty') };
  }
  if (settings.isError) return { status: 'error', errorText: t('console.settings.loadFailed'), onRetry: () => void settings.refetch() };
  return { status: 'loading' };
}

/**
 * One area's settings (#604): each by name, its value now, who changes it and the changes to come. Opening one shows it
 * beside the list from 1180 px, and in its place below.
 */
export function RulesArea({ venueId, area, isSuperAdmin }: { venueId: string; area: RuleArea; isSuperAdmin: boolean }) {
  const settings = useVenueSettings(venueId);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const tiers = settings.data?.tiers ?? [];
  const tierName = (id: string) => tiers.find((tier) => tier.subject === id)?.label ?? id;
  const columns: readonly DataTableColumn<VenueSetting>[] = [
    { key: 'name', header: t('console.settings.keyColumn'), cell: (setting) => settingName(setting.key), sortValue: (setting) => settingName(setting.key) },
    { key: 'now', header: t('console.settings.nowColumn'), cell: (setting) => nowText(setting, tierName) },
    { key: 'who', header: t('console.settings.whoColumn'), cell: (setting) => t(isSuperAdminOnly(setting.key) ? 'console.settings.superAdminOnly' : 'console.settings.managers') },
    { key: 'toCome', header: t('console.settings.toComeColumn'), align: 'end', sortValue: toCome,
      cell: (setting) => (toCome(setting) === 0 ? t('console.settings.noneToCome') : formatNumber(toCome(setting))) },
  ];
  const open = settings.data?.settings.find((setting) => setting.key === openKey);
  const list = (
    <Stack gap={4}>
      <Text tone="muted">{t('console.settings.rulesHint')}</Text>
      <DataTable label={t('console.settings.table')} columns={columns} rowKey={(setting) => setting.key} {...tableState(settings, area)}
        filter={{ label: t('console.settings.filter'), text: (setting) => `${settingName(setting.key)} ${settingHelp(setting.key, setting.description)}` }}
        onRowOpen={(setting) => setOpenKey(setting.key)} />
    </Stack>
  );
  const detail = open === undefined ? null : <SettingPanel key={open.key} venueId={venueId} setting={open} tiers={tiers} isSuperAdmin={isSuperAdmin} />;
  return (
    <SplitView list={list} detail={detail} backLabel={t('console.settings.backTo', { area: t(`console.settings.areas.${area}`) })}
      onBack={() => setOpenKey(null)} emptyText={t('console.settings.chooseSetting')} />
  );
}
