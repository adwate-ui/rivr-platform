import { useTablesSetupActions, type SetupStake, type SetupTable } from '@rivr/db';
import { formatNumber, t } from '@rivr/i18n';
import { Button, ChoiceChips, DataTable, ErrorMessage, Grid, Heading, Inline, Input, Stack, StatusMessage, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { TableActions, type TableOutcome } from './TableActions.tsx';

// A table seats 2 to 10, as game_table's check has it.
const SEATS = ['2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;

// The form open: a new table's, above the list, or a table's own by its id, under its row.
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

/** The tables' columns: name, stake, seats and status, then the table's actions. */
function tableColumns(props: TablesBlockProps & { onChange: (table: SetupTable) => void; onOutcome: (outcome: TableOutcome) => void }) {
  const stakeName = (table: SetupTable) => props.stakes.find((stake) => stake.id === table.stakeId)?.name ?? '';
  const columns: readonly DataTableColumn<SetupTable>[] = [
    { key: 'name', header: t('console.tablesSetup.name'), cell: (table) => table.name, sortValue: (table) => table.name, priority: 'primary' },
    { key: 'stake', header: t('console.tablesSetup.stake'), cell: stakeName, sortValue: stakeName },
    { key: 'seats', header: t('console.tablesSetup.seats'), cell: (table) => String(table.seats), sortValue: (table) => table.seats, align: 'end' },
    { key: 'status', header: t('console.tablesSetup.statusColumn'), cell: statusOf, isWide: true },
    {
      key: 'actions', header: '', isWide: true, align: 'end',
      cell: (table) => <TableActions venueId={props.venueId} table={table} onChange={() => props.onChange(table)} onOutcome={props.onOutcome} />,
    },
  ];
  return columns;
}

/**
 * The tables in floor order (console v3; decision 0432), each with its status and its actions: Change opens its form under
 * its row, New table an empty one above the list. What an action did is said under the list.
 */
export function TablesBlock({ venueId, stakes, tables }: TablesBlockProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<TableOutcome | null>(null);
  const toggle = (next: string) => { setOutcome(null); setOpen(open === next ? null : next); };
  const form = (table: SetupTable | null) => (
    <TableForm key={table?.id ?? NEW} venueId={venueId} stakes={stakes} table={table} onCancel={() => setOpen(null)}
      onSaved={(text) => { setOpen(null); setOutcome({ ok: true, text }); }} />
  );
  const columns = tableColumns({ venueId, stakes, tables, onChange: (table) => toggle(table.id), onOutcome: setOutcome });
  return (
    <Stack gap={4}>
      <Inline justify="between" gap={4}>
        <Heading level={2} variant="section">{t('console.tablesSetup.tables')}</Heading>
        {/* A table needs a stake: until there is one, New stake is the way in. */}
        {stakes.length === 0 ? null : <Button variant="subtle" size="compact" onClick={() => toggle(NEW)}>{t('console.tablesSetup.newTable')}</Button>}
      </Inline>
      {open === NEW ? form(null) : null}
      <DataTable label={t('console.tablesSetup.tablesLabel')} columns={columns} rows={tables} rowKey={(table) => table.id}
        emptyText={t('console.tablesSetup.tablesEmpty')} rowDetail={(table) => (open === table.id ? form(table) : null)} />
      <StatusMessage>{outcome?.ok === true ? outcome.text : null}</StatusMessage>
      {outcome?.ok === false ? <ErrorMessage>{outcome.text}</ErrorMessage> : null}
    </Stack>
  );
}

interface TableFormProps {
  venueId: string;
  stakes: readonly SetupStake[];
  table: SetupTable | null;
  onSaved: (text: string) => void;
  onCancel: () => void;
}

/** The form's values to start from: the table's own, or a new nine-seat table with no stake chosen. */
function startFrom(table: SetupTable | null) {
  if (table === null) return { tableId: null, name: '', stakeId: null, seats: '9', heading: t('console.tablesSetup.newTable') };
  return { tableId: table.id, name: table.name, stakeId: table.stakeId, seats: String(table.seats), heading: t('console.tablesSetup.changeTable', { name: table.name }) };
}

/** A table's name, stake and seats. */
function TableForm({ venueId, stakes, table, onSaved, onCancel }: TableFormProps) {
  const { saveTable } = useTablesSetupActions(venueId);
  const [start] = useState(() => startFrom(table));
  const [name, setName] = useState(start.name);
  const [stakeId, setStakeId] = useState<string | null>(start.stakeId);
  const [seats, setSeats] = useState(start.seats);
  const [failure, setFailure] = useState<string | null>(null);
  const submit = async (chosen: string) => {
    const done = await saveTable.mutateAsync({ tableId: start.tableId, name, stakeId: chosen, seats: Number(seats) });
    if (done.ok) onSaved(t('console.tablesSetup.saved', { name: name.trim() }));
    else setFailure(t(`console.tablesSetup.failures.${done.error}`));
  };
  return (
    <Stack gap={4}>
      <Heading level={3}>{start.heading}</Heading>
      <Grid columns={2} gap={4} stackBelow="medium">
        <Input label={t('console.tablesSetup.tableName')} value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
        <ChoiceChips label={t('console.tablesSetup.seats')} mode="one" look="subtle" selected={[seats]} options={SEATS.map((count) => ({ value: count, label: count }))}
          onChange={(picked) => setSeats(picked[0] ?? seats)} />
      </Grid>
      <ChoiceChips label={t('console.tablesSetup.stake')} mode="one" look="subtle" selected={stakeId === null ? [] : [stakeId]}
        options={stakes.map((stake) => ({ value: stake.id, label: stake.name }))} onChange={(picked) => setStakeId(picked[0] ?? null)} />
      <Inline gap={3}>
        {/* Not the screen's one action, so not gold (A-13); a save of half a form says what is missing (UI-19). */}
        <Button variant="subtle" size="compact" isLoading={saveTable.isPending}
          onClick={() => { if (name.trim() === '' || stakeId === null) setFailure(t('console.tablesSetup.tableIncomplete')); else void submit(stakeId); }}>
          {t('console.tablesSetup.saveTable')}
        </Button>
        <Button variant="text" size="compact" onClick={onCancel}>{t('common.cancel')}</Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </Stack>
  );
}
