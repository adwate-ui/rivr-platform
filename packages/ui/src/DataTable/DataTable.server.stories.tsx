import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, screen, userEvent } from 'storybook/test';
import { DataTable, type DataTableColumn } from './DataTable.tsx';
import { DataTableViewProvider } from './DataTableView.tsx';
import type { ViewWire } from './tableView.ts';

interface Member {
  readonly number: number;
  readonly name: string;
  readonly tier: string;
  readonly status: string;
  readonly visits: number;
}

const NAMES = ['Aanya Khurana', 'Ajay Dhillon', 'Alok Thakur', 'Arjun Mehta', 'Ishaan Verma', 'Kabir Sethi', 'Mihir Sinha', 'Rhea Sood', 'Ritika Bhalla', 'Riya Sen', 'Tara Bedi', 'Vihaan Kapoor'];
const TIERS = ['Member', "Founders' Circle", 'Black card'];

/** One page of members as the server would give it, fixed so screenshots match. */
function members(count: number): Member[] {
  return Array.from({ length: count }, (_, index) => ({
    number: ((index * 37) % 150) + 1,
    name: NAMES[index % NAMES.length] ?? '',
    tier: TIERS[index % TIERS.length] ?? '',
    status: index === 10 ? 'On a break' : 'Active',
    visits: (index * 13) % 47,
  }));
}

// Every column says its kind, as a page of rows cannot tell it; the choices carry the server's counts over every member.
const COLUMNS: readonly DataTableColumn<Member>[] = [
  { key: 'name', header: 'Name', cell: (row) => row.name, sortValue: (row) => row.name, filter: 'text' },
  { key: 'number', header: 'No.', cell: (row) => row.number, sortValue: (row) => row.number, filter: 'number' },
  { key: 'tier', header: 'Tier', cell: (row) => row.tier, sortValue: (row) => row.tier, filter: 'choice',
    choices: [{ value: 'Black card', count: 312 }, { value: "Founders' Circle", count: 48 }, { value: 'Member', count: 4452 }] },
  { key: 'status', header: 'Status', cell: (row) => row.status, filter: 'choice', choices: [{ value: 'Active', count: 4809 }, { value: 'On a break', count: 3 }] },
  { key: 'visits', header: 'Visits', cell: (row) => row.visits, sortValue: (row) => row.visits, filter: 'number', align: 'end' },
];

interface ServerTableProps {
  state?: 'ready' | 'loading' | 'error';
  /** The rows of the page shown. */
  rows?: readonly Member[];
  /** Every row the search and filters leave, as the server counts them. */
  total?: number;
  /** The view the console's address holds: a page, an order, filters. */
  view?: ViewWire;
}

/** Members as the console will hold it (redesign RD-13): 12 to a page, sorted, searched, filtered and paged by the screen. */
function ServerTable({ state = 'ready', rows = members(12), total = 4812, view }: ServerTableProps) {
  const base = {
    label: 'Members', columns: COLUMNS, rowKey: (row: Member) => String(row.number), initialSort: { key: 'name', direction: 'ascending' } as const,
    filter: { label: 'Name, mobile or member number', text: (row: Member) => row.name }, server: { total, pageSize: 12, onRequest: () => undefined },
  };
  const table = state === 'loading' ? <DataTable {...base} status="loading" />
    : state === 'error' ? <DataTable {...base} status="error" onRetry={() => undefined} />
      : <DataTable {...base} rows={rows} emptyText="No members yet." />;
  return <DataTableViewProvider store={{ read: () => view, write: () => undefined }}>{table}</DataTableViewProvider>;
}

const meta = { title: 'Data/DataTable/Server mode', component: ServerTable } satisfies Meta<typeof ServerTable>;

const DESK = ['viewport-console'];

export default meta;
type Story = StoryObj<typeof meta>;

/** The first of 193 pages: how many show of all above the table, the pages in its foot. */
export const ManyPages: Story = { tags: DESK };

/** A page in the middle: the first and last pages either side of it and its neighbours. */
export const AMiddlePage: Story = { args: { view: { p: 50 } }, tags: DESK };

/** Every row fits one page: no pages in the foot. */
export const OnePage: Story = { args: { rows: members(8), total: 8 }, tags: DESK };

export const Loading: Story = { args: { state: 'loading' } };

export const Empty: Story = { args: { rows: [], total: 0 } };

export const Error: Story = { args: { state: 'error' } };

/** The filters leave nothing: the header stays, with why under it. */
export const FilteredToNothing: Story = { args: { rows: [], total: 0, view: { q: 'zz', f: { tier: ['c', 'Black card'] } } } };

/** A column's menu with the server's counts (redesign correction 4), a filter on: its pill and Clear all beside it. */
export const MenuWithServerCounts: Story = {
  args: { rows: members(12).map((row) => ({ ...row, tier: 'Black card' })), total: 312, view: { f: { tier: ['c', 'Black card'] } } },
  tags: DESK,
  play: async () => {
    await userEvent.click(screen.getByRole('button', { name: /^Tier: sort and filter/ }));
    await expect(screen.getByRole('dialog', { name: 'Tier: sort and filter' })).toBeInTheDocument();
  },
};

/** On a phone each row is a card; the pages keep 44 px targets. */
export const ManyPagesOnAPhone: Story = { tags: ['viewport-phone'] };

/** On a tablet held upright (768 px). */
export const ManyPagesOnAPortraitTablet: Story = { tags: ['viewport-portrait'] };
