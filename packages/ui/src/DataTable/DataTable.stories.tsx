import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Money } from '../Money/Money.tsx';
import { Text } from '../Text/Text.tsx';
import { DataTable, type DataTableColumn, type DataTableSort } from './DataTable.tsx';
import { DataTableExportProvider } from './DataTableExport.tsx';

interface Marker {
  readonly id: string;
  readonly name: string;
  readonly tier: string;
  readonly amount: bigint;
  readonly ageDays: number;
}

const NAMES = ['Arjun Mehta', 'Kabir Sethi', 'Naina Kapoor', 'Rohan Bhatia', 'Ishaan Verma', 'Vihaan Kapoor', 'Mihir Shah', 'Yash Gupta'];
const TIERS = ['Black card', 'Member', "Founders' Circle"];

/** Rows a story can show: names, tiers, amounts in whole ₹50 chips and ages, all fixed so screenshots match. */
function markers(count: number): Marker[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `MK-${String(index + 1).padStart(5, '0')}`,
    name: `${NAMES[index % NAMES.length] ?? ''}${index < NAMES.length ? '' : ` ${Math.floor(index / NAMES.length) + 1}`}`,
    tier: TIERS[index % TIERS.length] ?? '',
    amount: BigInt(((index * 7919) % 40) + 1) * 500_000n,
    ageDays: (index * 13) % 45,
  }));
}

const COLUMNS: readonly DataTableColumn<Marker>[] = [
  { key: 'id', header: 'Marker', cell: (row) => <Text tone="muted">{row.id}</Text> },
  { key: 'name', header: 'Member', cell: (row) => row.name, sortValue: (row) => row.name },
  { key: 'tier', header: 'Tier', cell: (row) => <Text tone="muted">{row.tier}</Text>, sortValue: (row) => row.tier },
  { key: 'age', header: 'Age (days)', cell: (row) => row.ageDays, sortValue: (row) => row.ageDays, align: 'end' },
  { key: 'amount', header: 'Outstanding', cell: (row) => <Money paise={row.amount} />, sortValue: (row) => row.amount, align: 'end' },
];

interface MarkerTableProps {
  state?: 'ready' | 'loading' | 'error';
  rows?: readonly Marker[];
  initialSort?: DataTableSort;
  withFilter?: boolean;
  /** Beneath an export provider, as every console table is for staff who export tables (#102). */
  withExport?: boolean;
  density?: 'comfortable' | 'compact';
  narrowLayout?: 'cards' | 'scroll';
}

/** The table as the console's Markers screen would hold it: open markers, by member. */
function MarkerTable({ withExport = false, ...props }: MarkerTableProps) {
  if (!withExport) return <Markers {...props} />;
  return <DataTableExportProvider exporter={async () => true}><Markers {...props} /></DataTableExportProvider>;
}

function Markers({ state = 'ready', rows = markers(8), initialSort, withFilter = false, ...look }: Omit<MarkerTableProps, 'withExport'>) {
  const base = {
    label: 'Open markers', columns: COLUMNS, rowKey: (row: Marker) => row.id, ...look, ...(initialSort ? { initialSort } : {}),
    ...(withFilter ? { filter: { label: 'Find a member', text: (row: Marker) => row.name } } : {}),
  };
  if (state === 'loading') return <DataTable {...base} status="loading" />;
  if (state === 'error') return <DataTable {...base} status="error" onRetry={() => undefined} />;
  return <DataTable {...base} rows={rows} emptyText="No markers outstanding." />;
}

// A table that ticks rows: every cell in the full colour, which stays clear on a ticked row's fill.
const TICKED_COLUMNS: readonly DataTableColumn<Marker>[] = [
  { key: 'name', header: 'Member', cell: (row) => row.name, sortValue: (row) => row.name },
  { key: 'id', header: 'Marker', cell: (row) => row.id },
  { key: 'tier', header: 'Tier', cell: (row) => row.tier, sortValue: (row) => row.tier },
  { key: 'age', header: 'Age (days)', cell: (row) => row.ageDays, sortValue: (row) => row.ageDays, align: 'end' },
  { key: 'amount', header: 'Outstanding', cell: (row) => <Money paise={row.amount} />, sortValue: (row) => row.amount, align: 'end' },
];

/** Markers a screen acts on several at a time: two ticked, rows that open on a click. */
function TickedMarkers({ narrowLayout = 'cards' }: { narrowLayout?: 'cards' | 'scroll' }) {
  const [selected, setSelected] = useState<readonly string[]>(['MK-00002', 'MK-00005']);
  return (
    <DataTable label="Open markers" columns={TICKED_COLUMNS} rowKey={(row) => row.id} rows={markers(8)} emptyText="No markers outstanding."
      selection={{ selected, onChange: setSelected }} onRowOpen={() => undefined} narrowLayout={narrowLayout} />
  );
}

const meta = { title: 'Data/DataTable', component: MarkerTable } satisfies Meta<typeof MarkerTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Sorted by the amount outstanding, largest first: the header shows which way. */
export const Sorted: Story = { args: { initialSort: { key: 'amount', direction: 'descending' } } };

/** With a filter box above, matching a member's name. */
export const WithFilter: Story = { args: { withFilter: true } };

/** For staff who export tables: one small Export control at the top right, offering CSV and XLSX (#102). */
export const WithExport: Story = { args: { withFilter: true, withExport: true } };

export const Loading: Story = { args: { state: 'loading' } };

export const Empty: Story = { args: { rows: [] } };

export const Error: Story = { args: { state: 'error' } };

export const LongText: Story = {
  args: { rows: markers(3).map((row) => ({ ...row, name: `${row.name}, who has a much longer name than any member has` })) },
};

/** Ten thousand rows: past 200, only the rows in view are drawn, so it scrolls smoothly (the @perf check). */
export const ManyRows: Story = { args: { rows: markers(10_000), initialSort: { key: 'name', direction: 'ascending' } } };

/** At a desk: a line per row under the column headers. */
export const AtADesk: Story = { tags: ['viewport-console'] };

/** On a phone each row is a card: the marker as its title, then each column named beside its value (#603). */
export const OnAPhone: Story = { tags: ['viewport-phone'] };

/** On a tablet held upright (768 px) rows are lines again. */
export const OnAPortraitTablet: Story = { tags: ['viewport-portrait'] };

/** Ten thousand rows as cards on a phone: still only the cards in view are drawn (the @perf check). */
export const ManyRowsOnAPhone: Story = { ...ManyRows, tags: ['viewport-phone'] };

/** At a desk, compact: rows 34 px high from 1180 px, for a screen that shows many at once. */
export const Compact: Story = { args: { density: 'compact' }, tags: ['viewport-console'] };

/** Ticks for acting on several rows at once: two ticked, on the chosen fill; the header's tick shows a dash for some. */
export const Ticked: Story = { render: () => <TickedMarkers />, tags: ['viewport-console'] };

/** Ticks on a phone's cards: each tick at its card's start, the header's above them. */
export const TickedOnAPhone: Story = { render: () => <TickedMarkers />, tags: ['viewport-phone'] };

/** The scroll layout on a phone: the lines under their header scroll sideways, the ticks and the member held. */
export const ScrollOnAPhone: Story = { render: () => <TickedMarkers narrowLayout="scroll" />, tags: ['viewport-phone'] };

/** A row opened in place (console v3): its form under it across the table, such as a dealer's new PIN. */
export const RowOpenInPlace: Story = {
  render: () => (
    <DataTable label="Open markers" columns={TICKED_COLUMNS} rowKey={(row) => row.id} rows={markers(4)} emptyText="No markers outstanding."
      rowDetail={(row) => (row.id === 'MK-00002' ? <Text>{`Settle ${row.id} from here.`}</Text> : null)} />
  ),
  tags: ['viewport-console'],
};
