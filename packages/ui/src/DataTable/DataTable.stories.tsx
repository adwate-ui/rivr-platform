import type { Meta, StoryObj } from '@storybook/react-vite';
import { Money } from '../Money/Money.tsx';
import { Text } from '../Text/Text.tsx';
import { DataTable, type DataTableColumn, type DataTableSort } from './DataTable.tsx';

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
}

/** The table as the console's Markers screen would hold it: open markers, by member. */
function MarkerTable({ state = 'ready', rows = markers(8), initialSort, withFilter = false }: MarkerTableProps) {
  const base = {
    label: 'Open markers', columns: COLUMNS, rowKey: (row: Marker) => row.id, ...(initialSort ? { initialSort } : {}),
    ...(withFilter ? { filter: { label: 'Find a member', text: (row: Marker) => row.name } } : {}),
  };
  if (state === 'loading') return <DataTable {...base} status="loading" />;
  if (state === 'error') return <DataTable {...base} status="error" onRetry={() => undefined} />;
  return <DataTable {...base} rows={rows} emptyText="No markers outstanding." />;
}

const meta = { title: 'Data/DataTable', component: MarkerTable } satisfies Meta<typeof MarkerTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Sorted by the amount outstanding, largest first: the header shows which way. */
export const Sorted: Story = { args: { initialSort: { key: 'amount', direction: 'descending' } } };

/** With a filter box above, matching a member's name. */
export const WithFilter: Story = { args: { withFilter: true } };

export const Loading: Story = { args: { state: 'loading' } };

export const Empty: Story = { args: { rows: [] } };

export const Error: Story = { args: { state: 'error' } };

export const LongText: Story = {
  args: { rows: markers(3).map((row) => ({ ...row, name: `${row.name}, who has a much longer name than any member has` })) },
};

/** Ten thousand rows: past 200, only the rows in view are drawn, so it scrolls smoothly (the @perf check). */
export const ManyRows: Story = { args: { rows: markers(10_000), initialSort: { key: 'name', direction: 'ascending' } } };
