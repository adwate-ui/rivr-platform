import { t } from '@rivr/i18n';
import { Box } from '../Box/Box.tsx';
import { Button } from '../Button/Button.tsx';
import { DataTable, type DataTableColumn } from '../DataTable/DataTable.tsx';
import { Heading } from '../Heading/Heading.tsx';
import { Stack } from '../Stack/Stack.tsx';
import { Text } from '../Text/Text.tsx';

/** One setting as its group lists it. */
export interface SettingsRow {
  readonly key: string;
  /** The setting's name: "Seat hold". */
  readonly name: string;
  /** One line under the name, eight words or fewer: "How long a called seat waits". */
  readonly line: string;
  /** Its value now, in words: "20 minutes". */
  readonly now: string;
  /** Who may change it: "Admins". */
  readonly who: string;
  /** The changes to come, in words, or a dash for none. */
  readonly toCome: string;
  /** Opens its change; left out for a staff member who may not change it, and the row has no Change. */
  readonly onChange?: (() => void) | undefined;
}

export interface SettingsGroupProps {
  /** The group's name, a noun: "Seating". */
  heading: string;
  settings: readonly SettingsRow[];
}

/** The setting's name over its one line. */
function SettingName({ setting }: { setting: SettingsRow }) {
  return (
    <span className="flex flex-col">
      {setting.name}
      <Text as="span" variant="secondary" tone="muted">{setting.line}</Text>
    </span>
  );
}

/** A row's Change, named for its setting; nothing for a setting the staff member may not change. */
function ChangeButton({ setting }: { setting: SettingsRow }) {
  if (setting.onChange === undefined) return null;
  return (
    <Button variant="subtle" size="small" aria-label={t('ui.console.settingsGroup.changeNamed', { name: setting.name })} onClick={setting.onChange}>
      {t('ui.console.settingsGroup.change')}
    </Button>
  );
}

/** Setting, Now, Who changes it, Changes to come, then Change: plain columns, with nothing to sort or filter within a group. */
function columns(): readonly DataTableColumn<SettingsRow>[] {
  return [
    { key: 'setting', header: t('ui.console.settingsGroup.setting'), isWide: true, filter: false, cell: (setting) => <SettingName setting={setting} /> },
    { key: 'now', header: t('ui.console.settingsGroup.now'), isWide: true, filter: false, cell: (setting) => setting.now },
    { key: 'who', header: t('ui.console.settingsGroup.who'), filter: false, cell: (setting) => setting.who },
    { key: 'toCome', header: t('ui.console.settingsGroup.toCome'), filter: false, cell: (setting) => setting.toCome },
    { key: 'change', header: '', align: 'end', cell: (setting) => <ChangeButton setting={setting} /> },
  ];
}

/**
 * A group of settings on a raised panel (redesign RD-14): its heading, then a row for each setting with its name and one
 * line, its value now, who changes it, the changes to come and Change, which the screen opens the change from. The rows
 * are a DataTable's, so a phone shows each setting as a card. A group has no Export of its own: the screen's one Export
 * covers every group.
 */
export function SettingsGroup({ heading, settings }: SettingsGroupProps) {
  return (
    <Box surface="raised" radius="md" padding={5}>
      <Stack gap={4}>
        <Heading level={2}>{heading}</Heading>
        {/* exportIn null: DataTable then draws no Export, though the console lets this staff member export tables. */}
        <DataTable label={heading} columns={columns()} rows={settings} rowKey={(setting) => setting.key} emptyText={t('ui.console.settingsGroup.empty')} exportIn={null} />
      </Stack>
    </Box>
  );
}
