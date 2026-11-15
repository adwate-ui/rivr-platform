import { formatNumber, t } from '@rivr/i18n';
import { useState } from 'react';
import { ExportBar, useTableExporter } from '../DataTable/DataTableExport.tsx';
import { Input } from '../Input/Input.tsx';
import { SettingsGroup, settingsValueText, type SettingsGroupProps, type SettingsRow } from '../SettingsGroup/SettingsGroup.tsx';
import { Text } from '../Text/Text.tsx';

export interface SettingsGroupsProps {
  /** What the settings are, as their export is named: "Settings". */
  label: string;
  /** The search box's name: "Find a setting". */
  searchLabel: string;
  /** Each group in order, with every setting it holds. */
  groups: readonly SettingsGroupProps[];
}

/** The columns one export of every group gives, as the groups name them. */
function exportColumns() {
  return [
    { header: t('ui.console.settingsGroup.setting'), cell: (setting: SettingsRow) => setting.name },
    { header: t('ui.console.settingsGroup.now'), cell: (setting: SettingsRow) => settingsValueText(setting.now) },
    { header: t('ui.console.settingsGroup.who'), cell: (setting: SettingsRow) => setting.who },
    { header: t('ui.console.settingsGroup.toCome'), cell: (setting: SettingsRow) => settingsValueText(setting.toCome) },
  ];
}

/** Whether the words typed are in the setting's name or its line. */
const isFound = (setting: SettingsRow, words: string) => `${setting.name} ${setting.line}`.toLowerCase().includes(words);

/**
 * A screen's groups of settings under one search and one Export (redesign RD-18). The search narrows every group by a
 * setting's name and line, a group left with nothing is not drawn, and how many show of all is said while it narrows.
 * Beneath a DataTableExportProvider, Export saves the settings shown, of every group, as one file.
 */
export function SettingsGroups({ label, searchLabel, groups }: SettingsGroupsProps) {
  const exporter = useTableExporter();
  const [query, setQuery] = useState('');
  const words = query.trim().toLowerCase();
  const found = groups.map((group) => ({ ...group, settings: group.settings.filter((setting) => isFound(setting, words)) }));
  const shown = found.flatMap((group) => group.settings);
  const total = groups.reduce((count, group) => count + group.settings.length, 0);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1 basis-full medium:basis-0">
          <Input type="search" label={searchLabel} value={query} autoComplete="off" onChange={(event) => setQuery(event.target.value)} />
        </div>
        {words === '' ? null : (
          <span role="status" className="flex min-h-touch items-center">
            <Text variant="small" tone="muted">{t('ui.dataTable.shownOf', { shown: formatNumber(shown.length), total: formatNumber(total) })}</Text>
          </span>
        )}
        {exporter === null || shown.length === 0 ? null : (
          <ExportBar isInBar exporter={exporter} label={label} columns={exportColumns()} rows={shown} filter={words === '' ? '' : `${searchLabel}: ${query.trim()}`} />
        )}
      </div>
      {found.map((group) => (group.settings.length === 0 ? null : <SettingsGroup key={group.heading} {...group} />))}
      {shown.length === 0 ? <Text tone="muted">{t('ui.console.settingsGroup.empty')}</Text> : null}
    </div>
  );
}
