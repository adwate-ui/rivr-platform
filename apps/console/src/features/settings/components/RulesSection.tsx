import { useVenueSettings, type VenueSetting } from '@rivr/db';
import { formatNumber, t } from '@rivr/i18n';
import { Button, DataTable, Heading, Stack, Text, type DataTableColumn, type DataTableState } from '@rivr/ui';
import { useState } from 'react';
import { SettingPanel } from './SettingPanel.tsx';

const toCome = (setting: VenueSetting) => setting.subjects.reduce((count, subject) => count + subject.scheduled.length, 0);

/** The keys, or loading, or why they could not be read. A failed refresh keeps what was known, so a value half typed stays put. */
function tableState(settings: ReturnType<typeof useVenueSettings>): DataTableState<VenueSetting> {
  if (settings.data !== undefined) return { rows: settings.data.settings, emptyText: t('console.settings.empty') };
  if (settings.isError) return { status: 'error', errorText: t('console.settings.loadFailed'), onRetry: () => void settings.refetch() };
  return { status: 'loading' };
}

/**
 * Every setting key in the database, so a key any lane adds shows here without screen changes: what it
 * applies to and how many changes are to come. Opening one shows its values and a form for a new one.
 */
export function RulesSection({ venueId }: { venueId: string }) {
  const settings = useVenueSettings(venueId);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const columns: readonly DataTableColumn<VenueSetting>[] = [
    { key: 'key', header: t('console.settings.keyColumn'), cell: (setting) => <Text weight="medium">{setting.key}</Text>, sortValue: (setting) => setting.key },
    { key: 'scope', header: t('console.settings.scopeColumn'), cell: (setting) => <Text>{t(`console.settings.scopes.${setting.scope}`)}</Text> },
    {
      key: 'toCome', header: t('console.settings.toComeColumn'), align: 'end', sortValue: toCome,
      cell: (setting) => <Text>{toCome(setting) === 0 ? t('console.settings.noneToCome') : formatNumber(toCome(setting))}</Text>,
    },
    {
      key: 'open', header: t('console.settings.open'), align: 'end',
      cell: (setting) => <Button variant="text" onClick={() => setOpenKey(setting.key)}>{t('console.settings.openKey', { key: setting.key })}</Button>,
    },
  ];
  const open = settings.data?.settings.find((setting) => setting.key === openKey);
  return (
    <Stack gap={6}>
      <Heading level={2}>{t('console.settings.rules')}</Heading>
      <Text tone="muted">{t('console.settings.rulesHint')}</Text>
      {open === undefined || settings.data === undefined ? null : (
        <SettingPanel key={open.key} venueId={venueId} setting={open} tiers={settings.data.tiers} onClose={() => setOpenKey(null)} />
      )}
      <DataTable label={t('console.settings.table')} columns={columns} rowKey={(setting) => setting.key} {...tableState(settings)}
        filter={{ label: t('console.settings.filter'), text: (setting) => `${setting.key} ${setting.description}` }} />
    </Stack>
  );
}
