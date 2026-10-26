import type { RakeRow } from '@rivr/db/reports';
import { formatNumber, t, type MessageKey } from '@rivr/i18n';
import { DataTable, Money, type DataTableColumn } from '@rivr/ui';

const VARIANT_COPY: Readonly<Record<string, MessageKey>> = {
  holdem: 'console.liveFloor.holdem', plo: 'console.liveFloor.plo', bomb_pot: 'console.liveFloor.bombPot',
};

/** A row's name: a table's or a dealer's as given, a game's in words. */
function rowName(row: RakeRow): string {
  const copy = VARIANT_COPY[row.key];
  return copy === undefined ? row.label : t(copy);
}

function columns(nameHeader: string): readonly DataTableColumn<RakeRow>[] {
  return [
    { key: 'name', header: nameHeader, cell: rowName, sortValue: rowName },
    { key: 'hands', header: t('console.reports.hands'), align: 'end', sortValue: (row) => row.hands, cell: (row) => formatNumber(row.hands) },
    { key: 'rake', header: t('console.reports.rake'), align: 'end', sortValue: (row) => row.rake, cell: (row) => <Money paise={row.rake} /> },
  ];
}

interface RakeTableProps {
  readonly label: string;
  /** The first column's heading: Table, Dealer or Game. */
  readonly nameHeader: string;
  /** Undefined while loading or after a failure. */
  readonly rows: readonly RakeRow[] | undefined;
  readonly isError: boolean;
  readonly onRetry: () => void;
  readonly emptyText: string;
  /** The screen's own filters, in words, for an export: the month. */
  readonly exportFilter?: string;
}

/** Rake by table, dealer or game, the most first, or the table's loading or error state. The month's drop is in its figures. */
export function RakeTable({ label, nameHeader, rows, isError, onRetry, emptyText, exportFilter }: RakeTableProps) {
  const base = { label, columns: columns(nameHeader), rowKey: (row: RakeRow) => row.key, ...(exportFilter === undefined ? {} : { exportFilter }) };
  if (rows === undefined && isError) return <DataTable {...base} status="error" onRetry={onRetry} />;
  if (rows === undefined) return <DataTable {...base} status="loading" />;
  return <DataTable {...base} rows={rows} emptyText={emptyText} initialSort={{ key: 'rake', direction: 'descending' }} />;
}
