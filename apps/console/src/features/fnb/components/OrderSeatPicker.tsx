import { useFloorSeats, useFloorTables, type SeatedPlayer } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ChoiceChips, LoadState, Skeleton, Stack, Text } from '@rivr/ui';

/** The venue's open, active tables with someone seated, in floor order, and who sits where; undefined until both reads answer. */
function useSeatedTables(venueId: string) {
  const tables = useFloorTables();
  const seats = useFloorSeats(venueId);
  const retry = () => {
    void tables.refetch();
    void seats.refetch();
  };
  if (tables.data === undefined || seats.data === undefined) return { isError: tables.isError || seats.isError, retry, floor: undefined };
  const seated = seats.data;
  const here = tables.data.filter((table) => table.venueId === venueId && table.isOpen && seated.some((one) => one.tableId === table.id));
  return { isError: false, retry, floor: { tables: here, seated } };
}

interface SeatsProps {
  seated: readonly SeatedPlayer[];
  tableId: string;
  seat: number | null;
  onSeat: (seat: number | null) => void;
}

/** The table's seated players by seat, each with who sits there: `3 · Sakshi Tandon`. */
function SeatChoice({ seated, tableId, seat, onSeat }: SeatsProps) {
  const atTable = seated.filter((one) => one.tableId === tableId).sort((a, b) => a.seat - b.seat);
  return (
    <ChoiceChips label={t('console.fnb.seat')} mode="one" look="subtle"
      options={atTable.map((one) => ({ value: String(one.seat), label: t('console.fnb.seatChoice', { seat: one.seat, name: one.fullName }) }))}
      selected={seat === null ? [] : [String(seat)]}
      onChange={([picked]) => onSeat(picked === undefined ? null : Number(picked))} />
  );
}

interface OrderSeatPickerProps {
  venueId: string;
  tableId: string | null;
  seat: number | null;
  /** A new table clears the seat chosen: the caller asks again. */
  onTable: (tableId: string | null) => void;
  onSeat: (seat: number | null) => void;
}

/**
 * Where a new order goes (console v3): the table first, of the open tables with someone seated, then the seat, showing who
 * sits there. Rows stand in while the floor is read; it says so if the read fails, or if nobody is seated.
 */
export function OrderSeatPicker({ venueId, tableId, seat, onTable, onSeat }: OrderSeatPickerProps) {
  const { floor, isError, retry } = useSeatedTables(venueId);
  if (floor === undefined) return isError ? <LoadState isError onRetry={retry} /> : <Skeleton look="rows" rows={2} />;
  if (floor.tables.length === 0) return <Text tone="muted">{t('console.fnb.nobodySeated')}</Text>;
  return (
    <Stack gap={4}>
      <ChoiceChips label={t('console.fnb.table')} mode="one" look="subtle"
        options={floor.tables.map((table) => ({ value: table.id, label: table.name }))}
        selected={tableId === null ? [] : [tableId]} onChange={([picked]) => onTable(picked ?? null)} />
      {tableId === null ? null : <SeatChoice seated={floor.seated} tableId={tableId} seat={seat} onSeat={onSeat} />}
    </Stack>
  );
}
