import { useSeatActions, type FloorTable, type SeatFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ChoiceChips, Stack } from '@rivr/ui';

interface TableControlsProps {
  venueId: string;
  table: FloorTable;
  tables: readonly FloorTable[];
  isEmpty: boolean;
  onResult: (outcome: { ok: true } | { ok: false; error: SeatFailure }) => void;
}

const OWN = 'own';

/**
 * For floor managers: open or close the table (it closes only empty), and whether it is a must-move
 * table feeding a main table of the same game, whose players move up in the order they sat down.
 */
export function TableControls({ venueId, table, tables, isEmpty, onResult }: TableControlsProps) {
  const { setOpen, setMustMove } = useSeatActions(venueId);
  const mains = tables.filter((other) => other.id !== table.id && other.tableTypeId === table.tableTypeId && other.mustMoveToTableId === null);
  const options = [{ value: OWN, label: t('console.liveFloor.ownTable') }, ...mains.map((main) => ({ value: main.id, label: main.name }))];
  const openLabel = table.isOpen ? t('console.liveFloor.closeTable') : t('console.liveFloor.openTable');
  return (
    <Stack gap={3} align="start">
      <Button variant="secondary" isDisabled={table.isOpen && !isEmpty} isLoading={setOpen.isPending}
        onClick={() => void setOpen.mutateAsync({ tableId: table.id, isOpen: !table.isOpen }).then(onResult)}>{openLabel}</Button>
      {mains.length === 0 ? null : (
        <ChoiceChips label={t('console.liveFloor.mustMoveTo')} mode="one" options={options} selected={[table.mustMoveToTableId ?? OWN]}
          isDisabled={setMustMove.isPending}
          onChange={([value]) => { if (value !== undefined) void setMustMove.mutateAsync({ tableId: table.id, mainTableId: value === OWN ? null : value }).then(onResult); }} />
      )}
    </Stack>
  );
}
