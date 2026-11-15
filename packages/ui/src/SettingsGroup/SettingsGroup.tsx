import { t } from '@rivr/i18n';
import { Box } from '../Box/Box.tsx';
import { Button } from '../Button/Button.tsx';
import { DataTable, type DataTableColumn } from '../DataTable/DataTable.tsx';
import { Heading } from '../Heading/Heading.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';

/** A value in words: one line that wraps, or several, each kept whole from 768 px, such as a value for each stake. */
export type SettingsValue = string | readonly string[];

/** One setting as its group lists it. */
export interface SettingsRow {
  readonly key: string;
  /** The setting's name: "Seat hold". */
  readonly name: string;
  /** One line under the name, eight words or fewer: "How long a called seat waits". */
  readonly line: string;
  /** Its value now, in words: "20 minutes"; or a line for each stake. */
  readonly now: SettingsValue;
  /** Who may change it: "Admins". */
  readonly who: string;
  /** The changes to come, in words, or a dash for none. */
  readonly toCome: SettingsValue;
  /** Opens its change; left out for a staff member who may not change it, and the row has no Change. */
  readonly onChange?: (() => void) | undefined;
  /** Opens what it was, is and will be, to read only: the row's action where there is no Change. */
  readonly onHistory?: (() => void) | undefined;
}

export interface SettingsGroupProps {
  /** The group's name, a noun: "Seating". */
  heading: string;
  settings: readonly SettingsRow[];
}

/** A value as one text, as an export or a search reads it. */
export const settingsValueText = (value: SettingsValue) => (typeof value === 'string' ? value : value.join(' · '));

/** The setting's name over its one line. */
function SettingName({ setting }: { setting: SettingsRow }) {
  return (
    <span className="flex flex-col">
      {setting.name}
      <Text as="span" variant="secondary" tone="muted">{setting.line}</Text>
    </span>
  );
}

/**
 * A value in its cell. On a phone's card it ends at the card's edge, as every value there does, so a wrapped one lines
 * up with the rest; from 768 px it starts with its column, and a value of several lines keeps each line whole.
 */
function Value({ value }: { value: SettingsValue }) {
  const lines = typeof value === 'string' ? null : value.map((line, at) => <span key={`${String(at)}:${line}`} className="block medium:whitespace-nowrap">{line}</span>);
  return <span className="min-w-0 text-end medium:text-start">{lines ?? value}</span>;
}

/** A row's action, named for its setting: Change, or History for a staff member who may only read it; else nothing. */
function RowAction({ setting }: { setting: SettingsRow }) {
  const action = setting.onChange === undefined ? 'history' : 'change';
  const onClick = setting.onChange ?? setting.onHistory;
  if (onClick === undefined) return null;
  return (
    <Button variant="subtle" size="small" aria-label={t(`ui.console.settingsGroup.${action}Named`, { name: setting.name })} onClick={onClick}>
      {t(`ui.console.settingsGroup.${action}`)}
    </Button>
  );
}

/** Setting, Now, Who changes it, Changes to come, then the row's action: plain columns, with nothing to sort or filter within a group. */
function columns(): readonly DataTableColumn<SettingsRow>[] {
  return [
    { key: 'setting', header: t('ui.console.settingsGroup.setting'), isWide: true, filter: false, cell: (setting) => <SettingName setting={setting} /> },
    { key: 'now', header: t('ui.console.settingsGroup.now'), isWide: true, filter: false, cell: (setting) => <Value value={setting.now} /> },
    { key: 'who', header: t('ui.console.settingsGroup.who'), filter: false, cell: (setting) => <Value value={setting.who} /> },
    { key: 'toCome', header: t('ui.console.settingsGroup.toCome'), isWide: true, filter: false, cell: (setting) => <Value value={setting.toCome} /> },
    { key: 'change', header: '', align: 'end', cell: (setting) => <RowAction setting={setting} /> },
  ];
}

/**
 * A group of settings on a raised panel (redesign RD-14): its heading, then a row for each setting with its name and one
 * line, its value now, who changes it, the changes to come and its action, Change or History, which the screen opens the
 * panel from. The rows are a DataTable's, so a phone shows each setting as a card; the last has no hairline under it, the
 * panel's edge being there. A group has no Export of its own: the screen's one Export covers every group.
 */
export function SettingsGroup({ heading, settings }: SettingsGroupProps) {
  return (
    <Box surface="raised" radius="md" padding={5}>
      <Stack gap={4}>
        <Heading level={2}>{heading}</Heading>
        <div className="[&_[role=rowgroup]:last-child_[role=row]:last-child]:border-b-0">
          {/* exportIn null: DataTable then draws no Export, though the console lets this staff member export tables. */}
          <DataTable label={heading} columns={columns()} rows={settings} rowKey={(setting) => setting.key} emptyText={t('ui.console.settingsGroup.empty')} exportIn={null} />
        </div>
      </Stack>
    </Box>
  );
}
