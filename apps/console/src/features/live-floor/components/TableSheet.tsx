import type { FloorNight, FloorTable, SeatedPlayer } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, DetailRow, Sheet, Stack, Text } from '@rivr/ui';
import { roomName, stakeOf } from './seatState.ts';
import type { TableChanges } from './useTableChanges.ts';

export interface TableSheetProps {
  table: FloorTable;
  tables: readonly FloorTable[];
  seats: readonly SeatedPlayer[];
  /** Tonight's dealers; undefined until read, or for a role without members.read. */
  night: FloorNight | undefined;
  /** Floor managers (floor.manage) open and close the table and set where it moves to. */
  canManage: boolean;
  changes: TableChanges;
  onClose: () => void;
}

const NONE = 'none';

/** Must move to: none, or an active table at the same stake that feeds no table itself. */
function MustMove({ table, tables, changes }: Pick<TableSheetProps, 'table' | 'tables' | 'changes'>) {
  const mains = tables.filter((other) => other.id !== table.id && other.tableTypeId === table.tableTypeId && other.mustMoveToTableId === null);
  const options = [{ value: NONE, label: t('console.floor.table.mustMoveNone') }, ...mains.map((main) => ({ value: main.id, label: main.name }))];
  return (
    <Stack gap={3}>
      <Text variant="caption" tone="muted">{t('console.floor.table.mustMoveTo')}</Text>
      <ChoiceChips look="subtle" mode="one" label={t('console.floor.table.mustMoveTo')} isLabelVisuallyHidden isDisabled={changes.isBusy}
        selected={[table.mustMoveToTableId ?? NONE]} options={options}
        onChange={([value]) => { if (value !== undefined) void changes.setMustMove(table, mains.find((main) => main.id === value) ?? null); }} />
    </Stack>
  );
}

/** Open the table, or close it for tonight: never while anyone sits there. */
function OpenClose({ table, seated, changes }: { table: FloorTable; seated: number; changes: TableChanges }) {
  const isHeldOpen = table.isOpen && seated > 0;
  return (
    <Stack gap={2}>
      <Button variant="subtle" fullWidth isDisabled={isHeldOpen} isLoading={changes.isBusy} onClick={() => void changes.setOpen(table, !table.isOpen)}>
        {t(table.isOpen ? 'console.floor.table.closeTable' : 'console.floor.table.openTable')}
      </Button>
      {isHeldOpen ? <Text variant="small" tone="muted">{t('console.floor.table.closeFirst')}</Text> : null}
    </Stack>
  );
}

/**
 * A table's sheet, from its tile's ⋯ (console v3): its status, who sits there, its dealer and how many wait on its list;
 * for floor managers, the table it must move to and Open or Close for tonight, each with Undo.
 */
export function TableSheet({ table, tables, seats, night, canManage, changes, onClose }: TableSheetProps) {
  const seated = seats.filter((player) => player.tableId === table.id).length;
  const dealer = night?.tables.find((one) => one.tableId === table.id)?.dealerName ?? null;
  const facts = [
    { label: t('console.floor.table.status'), value: t(table.isOpen ? 'console.floor.table.open' : 'console.floor.table.closed') },
    { label: t('console.floor.table.seated'), value: t('console.floor.table.seatedCount', { count: seated, seats: table.seats }) },
    { label: t('console.floor.table.dealer'), value: dealer ?? t('console.floor.table.noDealer') },
    { label: t('console.floor.table.waiting'), value: String(table.waiting) },
  ];
  return (
    <Sheet place="console" isOpen onClose={onClose} title={table.name} subtitle={t('console.floor.table.subtitle', { stake: stakeOf(table), room: roomName(table.room) })}
      footer={<Button variant="text" onClick={onClose}>{t('console.floor.player.close')}</Button>}>
      <Stack gap={0}>
        {facts.map((fact, index) => <DetailRow key={fact.label} label={fact.label} value={fact.value} size="small" labelTone="muted" isLast={index === facts.length - 1} />)}
      </Stack>
      {canManage ? <MustMove table={table} tables={tables} changes={changes} /> : null}
      {canManage ? <OpenClose table={table} seated={seated} changes={changes} /> : null}
    </Sheet>
  );
}
