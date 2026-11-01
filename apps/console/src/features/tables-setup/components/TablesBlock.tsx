import { useTablesSetupActions, type SetupStake, type SetupTable } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, DataTable, ErrorMessage, Grid, Heading, Inline, Input, Stack, StatusMessage, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';

// A table seats 2 to 10, as game_table's check has it.
const SEATS = ['2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;

interface TablesBlockProps {
  venueId: string;
  stakes: readonly SetupStake[];
  tables: readonly SetupTable[];
}

/** The tables in floor order, each with Change, beside the form for a new one or the one chosen. */
export function TablesBlock({ venueId, stakes, tables }: TablesBlockProps) {
  const [editing, setEditing] = useState<SetupTable | null>(null);
  const [saved, setSaved] = useState<{ round: number; text: string | null }>({ round: 0, text: null });
  const stakeName = (table: SetupTable) => stakes.find((stake) => stake.id === table.stakeId)?.name ?? '';
  const columns: readonly DataTableColumn<SetupTable>[] = [
    { key: 'name', header: t('console.tablesSetup.name'), cell: (table) => table.name, priority: 'primary' },
    { key: 'stake', header: t('console.tablesSetup.stake'), cell: stakeName, sortValue: stakeName },
    { key: 'seats', header: t('console.tablesSetup.seats'), cell: (table) => String(table.seats), sortValue: (table) => table.seats, align: 'end' },
    { key: 'now', header: t('console.tablesSetup.now'), cell: (table) => t(table.isOpen ? 'console.tablesSetup.open' : 'console.tablesSetup.closed') },
    {
      key: 'change', header: t('console.tablesSetup.change'),
      cell: (table) => (
        <Button variant="text" aria-label={t('console.tablesSetup.changeTable', { name: table.name })} onClick={() => setEditing(table)}>
          {t('console.tablesSetup.change')}
        </Button>
      ),
    },
  ];
  return (
    <Grid columns={2} gap={12} stackBelow="medium">
      <Stack gap={4}>
        <Heading level={2} variant="section">{t('console.tablesSetup.tables')}</Heading>
        <DataTable label={t('console.tablesSetup.tablesLabel')} columns={columns} rows={tables} rowKey={(table) => table.id}
          emptyText={t('console.tablesSetup.tablesEmpty')} />
        <StatusMessage>{saved.text}</StatusMessage>
      </Stack>
      {stakes.length === 0 ? null : (
        <TableForm key={editing?.id ?? `new-${saved.round}`} venueId={venueId} stakes={stakes} table={editing} onCancel={() => setEditing(null)}
          onSaved={(text) => { setEditing(null); setSaved((last) => ({ round: last.round + 1, text })); }} />
      )}
    </Grid>
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
      <Input label={t('console.tablesSetup.tableName')} value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
      <ChoiceChips label={t('console.tablesSetup.stake')} mode="one" selected={stakeId === null ? [] : [stakeId]}
        options={stakes.map((stake) => ({ value: stake.id, label: stake.name }))} onChange={(picked) => setStakeId(picked[0] ?? null)} />
      <ChoiceChips label={t('console.tablesSetup.seats')} mode="one" selected={[seats]} options={SEATS.map((count) => ({ value: count, label: count }))}
        onChange={(picked) => setSeats(picked[0] ?? seats)} />
      <Inline gap={3}>
        <Button variant="primary" isDisabled={name.trim() === '' || stakeId === null} isLoading={saveTable.isPending}
          onClick={() => { if (stakeId !== null) void submit(stakeId); }}>{t('console.tablesSetup.saveTable')}</Button>
        {start.tableId === null ? null : <Button variant="text" onClick={onCancel}>{t('common.cancel')}</Button>}
      </Inline>
      {failure === null ? null : <ErrorMessage>{failure}</ErrorMessage>}
    </Stack>
  );
}
