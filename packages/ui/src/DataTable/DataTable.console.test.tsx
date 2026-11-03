import { tokens } from '@rivr/tokens';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../Button/Button.tsx';
import { axeViolations, renderIn } from '../test/render.tsx';
import { DataTable, VIRTUAL_FROM, type DataTableColumn, type DataTableProps } from './DataTable.tsx';
import { DataTableDensityProvider } from './DataTableDensity.tsx';

// The console v3 table: ticks, a click anywhere on a row, density, and the scroll layout on a phone.

interface Player {
  readonly id: string;
  readonly name: string;
  readonly hours: number;
}

const COLUMNS: readonly DataTableColumn<Player>[] = [
  { key: 'name', header: 'Member', cell: (row) => row.name, sortValue: (row) => row.name },
  { key: 'hours', header: 'Hours', cell: (row) => row.hours, sortValue: (row) => row.hours, align: 'end' },
  { key: 'id', header: 'Card', cell: (row) => row.id },
];
const ROWS: readonly Player[] = [
  { id: 'c1', name: 'Naina Kapoor', hours: 12 },
  { id: 'c2', name: 'Arjun Mehta', hours: 30 },
  { id: 'c3', name: 'Kabir Sethi', hours: 4 },
];

type Extra = Partial<Pick<DataTableProps<Player>, 'onRowOpen' | 'density' | 'narrowLayout' | 'filter' | 'columns' | 'rowDetail'>> & { rows?: readonly Player[] };

/** A table whose ticks a screen keeps, as the console's screens do. */
function Ticked({ rows = ROWS, columns = COLUMNS, ...extra }: Extra) {
  const [selected, setSelected] = useState<readonly string[]>([]);
  return <DataTable label="Members" columns={columns} rowKey={(row) => row.id} rows={rows} emptyText="None." selection={{ selected, onChange: setSelected }} {...extra} />;
}

const tick = (name: string) => screen.getByRole('checkbox', { name });
const bodyRows = () => screen.getAllByRole('row').slice(1);

/** Below 768 px and 1180 px: every width query fails. */
function onAPhone() {
  vi.stubGlobal('matchMedia', (media: string) => ({ matches: false, media, addEventListener: () => undefined, removeEventListener: () => undefined }));
}

afterEach(() => vi.unstubAllGlobals());

describe('DataTable on the console', () => {
  it('ticks rows, each named for its title, with a header tick for all of them, half ticked when some are', async () => {
    renderIn(<Ticked />);
    expect(screen.getAllByRole('checkbox').map((box) => box.getAttribute('aria-label')))
      .toEqual(['Select all', 'Select Naina Kapoor', 'Select Arjun Mehta', 'Select Kabir Sethi']);
    await userEvent.click(tick('Select Arjun Mehta'));
    expect(tick('Select Arjun Mehta')).toBeChecked();
    expect(tick('Select all')).toBePartiallyChecked();
    await userEvent.click(tick('Select all'));
    expect(screen.getAllByRole('checkbox').every((box) => box instanceof HTMLInputElement && box.checked)).toBe(true);
    await userEvent.click(tick('Select all'));
    expect(screen.getAllByRole('checkbox').some((box) => box instanceof HTMLInputElement && box.checked)).toBe(false);
  });

  it('ticks all the rows as shown, filtered, and keeps the others as they were', async () => {
    renderIn(<Ticked filter={{ label: 'Find a member', text: (row) => row.name }} />);
    await userEvent.click(tick('Select Kabir Sethi'));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find a member' }), 'kap');
    await userEvent.click(tick('Select all'));
    expect(tick('Select all')).toBeChecked();
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Find a member' }));
    expect(tick('Select Naina Kapoor')).toBeChecked();
    expect(tick('Select Kabir Sethi')).toBeChecked();
    expect(tick('Select Arjun Mehta')).not.toBeChecked();
    expect(tick('Select all')).toBePartiallyChecked();
  });

  it('names a row by its key where its title is not words', () => {
    renderIn(<Ticked columns={[{ key: 'mark', header: 'Mark', cell: () => null }, ...COLUMNS.slice(1)]} />);
    expect(tick('Select c1')).toBeInTheDocument();
  });

  it('marks a ticked row with the chosen fill from 768 px, its text in the full colour, and gives each tick 44 px below 1180 px', async () => {
    renderIn(<Ticked />);
    await userEvent.click(tick('Select Naina Kapoor'));
    const [chosen, other] = bodyRows();
    expect(chosen).toHaveClass('medium:bg-selected');
    expect(other).not.toHaveClass('medium:bg-selected');
    for (const cell of within(chosen ?? document.body).getAllByRole('cell')) expect(cell).not.toHaveClass('text-content-muted');
    expect(tick('Select Naina Kapoor').closest('label')).toHaveClass('min-h-touch', 'min-w-touch', 'tablet:min-h-0', 'tablet:min-w-0');
  });

  it('opens a row from a click anywhere on it, but not from its tick or a button in a cell', async () => {
    const onRowOpen = vi.fn();
    const onSeat = vi.fn();
    const columns = [...COLUMNS, { key: 'seat', header: '', cell: () => <Button onClick={onSeat}>Seat</Button> }];
    renderIn(<Ticked columns={columns} onRowOpen={onRowOpen} />);
    const [first] = bodyRows();
    expect(first).toHaveClass('cursor-pointer', 'hover:bg-subtle');
    await userEvent.click(within(first ?? document.body).getByText('12'));
    expect(onRowOpen).toHaveBeenLastCalledWith(ROWS[0]);
    await userEvent.click(tick('Select Naina Kapoor'));
    await userEvent.click(within(first ?? document.body).getByRole('button', { name: 'Seat' }));
    expect(onRowOpen).toHaveBeenCalledOnce();
    expect(onSeat).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Naina Kapoor' }));
    expect(onRowOpen).toHaveBeenCalledTimes(2);
  });

  it('reaches the ticks and the title from the keyboard, never the row, and ticks with Space', async () => {
    renderIn(<Ticked onRowOpen={() => undefined} />);
    await userEvent.tab();
    expect(tick('Select all')).toHaveFocus();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(tick('Select Naina Kapoor')).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(tick('Select Naina Kapoor')).toBeChecked();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Naina Kapoor' })).toHaveFocus();
    for (const row of screen.getAllByRole('row')) expect(row).not.toHaveAttribute('tabindex');
  });

  it('keeps its header at the top of the scrolling page, on the page colour', () => {
    renderIn(<Ticked />);
    expect(screen.getAllByRole('rowgroup')[0]).toHaveClass('sticky', 'top-0', 'z-nav', 'bg-surface');
  });

  it('sets the console type: headers 12 px, the title 15 px medium, the rest 13 px', () => {
    renderIn(<Ticked />);
    expect(screen.getByRole('button', { name: 'Member' })).toHaveClass('text-12');
    const [title, hours] = within(bodyRows()[0] ?? document.body).getAllByRole('cell').slice(1);
    expect(title).toHaveClass('text-15', 'font-medium');
    expect(hours).toHaveClass('text-13');
  });

  it('draws rows at the comfortable height from 1180 px, or the compact one, a long list included', () => {
    const { unmount } = renderIn(<Ticked />);
    expect(bodyRows()[0]).toHaveClass('tablet:min-h-row');
    unmount();
    const second = renderIn(<Ticked density="compact" />);
    expect(bodyRows()[0]).toHaveClass('tablet:min-h-row-compact');
    second.unmount();
    const many = Array.from({ length: VIRTUAL_FROM + 1 }, (_, index) => ({ id: `c${index}`, name: `Member ${index}`, hours: index }));
    renderIn(<Ticked rows={many} density="compact" />);
    expect(bodyRows()[1]).toHaveStyle({ height: `${tokens.size.rowCompact}px`, transform: `translateY(${tokens.size.rowCompact}px)` });
  });

  it('takes the staff member’s own density from the frame, unless it sets one', () => {
    const { unmount } = renderIn(<DataTableDensityProvider density="compact"><Ticked /></DataTableDensityProvider>);
    expect(bodyRows()[0]).toHaveClass('tablet:min-h-row-compact');
    unmount();
    renderIn(<DataTableDensityProvider density="compact"><Ticked density="comfortable" /></DataTableDensityProvider>);
    expect(bodyRows()[0]).toHaveClass('tablet:min-h-row');
  });

  it('on a phone, scrolls the lines sideways under their header, the tick and title held, with no sort bar', () => {
    onAPhone();
    renderIn(<Ticked narrowLayout="scroll" />);
    expect(screen.queryByRole('group', { name: 'Sort Members' })).toBeNull();
    const [header, body] = screen.getAllByRole('rowgroup');
    expect(header?.firstElementChild).not.toHaveClass('hidden');
    expect(header?.firstElementChild).toHaveClass('grid', 'max-medium:min-w-text');
    expect(body).toHaveClass('max-medium:overflow-x-auto');
    const [box, title, hours] = within(bodyRows()[0] ?? document.body).getAllByRole('cell');
    expect(box).toHaveClass('max-medium:sticky', 'max-medium:left-0', 'max-medium:bg-surface');
    expect(title).toHaveClass('max-medium:sticky', 'max-medium:left-touch', 'max-medium:bg-surface');
    expect(hours).not.toHaveClass('max-medium:sticky');
    expect(hours).not.toHaveAttribute('data-label');
    expect(screen.getByRole('columnheader', { name: 'Member' })).toHaveClass('max-medium:sticky', 'max-medium:left-touch');
  });

  it('holds the title alone in the scroll layout without ticks, and keeps cards by default', () => {
    onAPhone();
    const { unmount } = renderIn(<DataTable label="Members" columns={COLUMNS} rowKey={(row) => row.id} rows={ROWS} emptyText="None." narrowLayout="scroll" />);
    expect(screen.getAllByRole('cell')[0]).toHaveClass('max-medium:sticky', 'max-medium:left-0');
    unmount();
    renderIn(<DataTable label="Members" columns={COLUMNS} rowKey={(row) => row.id} rows={ROWS} emptyText="None." />);
    expect(screen.getAllByRole('rowgroup')[0]?.firstElementChild).toHaveClass('hidden');
    expect(screen.getAllByRole('cell')[0]).not.toHaveClass('max-medium:sticky');
    expect(screen.getByRole('group', { name: 'Sort Members' })).toBeInTheDocument();
  });

  it('opens a row in place: its detail a row of its own under it, across every column, counted with the rows', async () => {
    const { container } = renderIn(<Ticked rowDetail={(row) => (row.id === 'c2' ? <Button>Save the hours</Button> : null)} />);
    const rows = bodyRows();
    expect(rows.map((row) => row.getAttribute('aria-rowindex'))).toEqual(['2', '3', '4', '5']);
    expect(within(rows[2] ?? document.body).getByRole('cell')).toHaveAttribute('aria-colspan', '4');
    expect(within(rows[2] ?? document.body).getByRole('button', { name: 'Save the hours' })).toBeInTheDocument();
    expect(within(rows[3] ?? document.body).getAllByRole('cell')[1]).toHaveTextContent('Kabir Sethi');
    expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', '5');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('draws no detail in a long list, whose rows are all one height', () => {
    const many = Array.from({ length: VIRTUAL_FROM + 1 }, (_, index) => ({ id: `c${index}`, name: `Member ${index}`, hours: index }));
    renderIn(<Ticked rows={many} rowDetail={() => <Button>Save the hours</Button>} />);
    expect(screen.queryByRole('button', { name: 'Save the hours' })).toBeNull();
  });

  it('has no accessibility violations with ticks, rows that open, and the scroll layout', async () => {
    const { container, unmount } = renderIn(<Ticked onRowOpen={() => undefined} />);
    await userEvent.click(tick('Select Arjun Mehta'));
    expect(await axeViolations(container)).toEqual([]);
    unmount();
    onAPhone();
    const phone = renderIn(<Ticked onRowOpen={() => undefined} narrowLayout="scroll" />);
    expect(await axeViolations(phone.container)).toEqual([]);
  });
});
