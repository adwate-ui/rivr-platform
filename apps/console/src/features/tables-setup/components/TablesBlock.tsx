import type { SetupStake, SetupTable } from '@rivr/db';
import { formatMoney, formatNumber, t } from '@rivr/i18n';
import { Button, DataTable, ErrorMessage, Screen, StatusMessage, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { TableActions, type TableOutcome } from './TableActions.tsx';
import { TableSheet } from './TableSheet.tsx';

// The panel open: a new table's, or a table's own by its id.
const NEW = 'new';

/** Where a table stands: inactive and hidden from the floor, active and closed tonight, or active with who sits at it. */
function statusOf(table: SetupTable): string {
  if (!table.isActive) return t('console.tablesSetup.status.inactive');
  return table.isOpen ? t('console.tablesSetup.status.open', { count: formatNumber(table.seated) }) : t('console.tablesSetup.status.closed');
}

interface TablesBlockProps {
  venueId: string;
  stakes: readonly SetupStake[];
  tables: readonly SetupTable[];
}

/** The tables' columns: name, stake, seats, its own minimum buy-in and status, then the row's steps. */
function tableColumns(props: TablesBlockProps & { onChange: (table: SetupTable) => void; onOutcome: (outcome: TableOutcome) => void }) {
  const stakeName = (table: SetupTable) => props.stakes.find((stake) => stake.id === table.stakeId)?.name ?? '';
  const columns: readonly DataTableColumn<SetupTable>[] = [
    { key: 'name', header: t('console.tablesSetup.name'), cell: (table) => table.name, sortValue: (table) => table.name, priority: 'primary', filter: 'text' },
    { key: 'stake', header: t('console.tablesSetup.stake'), cell: stakeName, sortValue: stakeName, filter: 'choice', filterValue: stakeName },
    { key: 'seats', header: t('console.tablesSetup.seats'), cell: (table) => String(table.seats), sortValue: (table) => table.seats, align: 'end' },
    // The one rupee figure on the console (owner, 15 Nov).
    { key: 'minBuyIn', header: t('console.tablesSetup.minBuyIn'), cell: (table) => formatMoney(table.minBuyIn), sortValue: (table) => table.minBuyIn, align: 'end', filter: false },
    { key: 'status', header: t('console.tablesSetup.statusColumn'), cell: statusOf, isWide: true },
    {
      key: 'actions', header: '', isWide: true, align: 'end',
      cell: (table) => <TableActions venueId={props.venueId} table={table} onChange={() => props.onChange(table)} onOutcome={props.onOutcome} />,
    },
  ];
  return columns;
}

/**
 * The tables in floor order (redesign RD-17; decision 0466), each with its stake, seats, minimum buy-in and status, Change
 * on the row and its other steps behind its menu. New table and Change open the panel at the side. What a row's step did
 * is said under the list.
 */
export function TablesBlock({ venueId, stakes, tables }: TablesBlockProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<TableOutcome | null>(null);
  const [exportIn, setExportIn] = useState<HTMLElement | null>(null);
  const show = (next: string) => { setOutcome(null); setOpen(next); };
  const columns = tableColumns({ venueId, stakes, tables, onChange: (table) => show(table.id), onOutcome: setOutcome });
  return (
    // A table needs a stake: until there is one, New stake is the way in.
    <Screen level={2} title={t('console.tablesSetup.tables')} onActionsSlot={setExportIn}
      actions={stakes.length === 0 ? undefined : <Button variant="subtle" size="compact" onClick={() => show(NEW)}>{t('console.tablesSetup.newTable')}</Button>}>
      <DataTable exportIn={exportIn} label={t('console.tablesSetup.tablesLabel')} columns={columns} rows={tables} rowKey={(table) => table.id}
        emptyText={t('console.tablesSetup.tablesEmpty')} />
      <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
      {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
      {open === null ? null : (
        <TableSheet key={open} venueId={venueId} stakes={stakes} table={tables.find((table) => table.id === open) ?? null} onClose={() => setOpen(null)} />
      )}
    </Screen>
  );
}
