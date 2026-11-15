import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTableExportProvider } from '../DataTable/DataTableExport.tsx';
import { axeViolations, renderIn } from '../test/render.tsx';
import { SettingsGroup, type SettingsRow } from './SettingsGroup.tsx';

const onSeatHold = vi.fn();
// The floor manager may change the seat hold; the priority rule is a super admin's.
const SEATING: readonly SettingsRow[] = [
  { key: 'seat_hold', name: 'Seat hold', line: 'How long a called seat waits', now: '20 minutes', who: 'Admins', toCome: '25 minutes from 16 Nov 2026', onChange: onSeatHold },
  { key: 'priority', name: 'Waitlist priority', line: 'Who is seated first', now: 'Black card first', who: 'Super admin', toCome: '–' },
];

const cellsOf = (row: HTMLElement) => within(row).getAllByRole('cell').map((cell) => cell.textContent);

describe('SettingsGroup', () => {
  it('names the group and lists each setting under its columns: its name and line, now, who changes it, changes to come', async () => {
    const { container } = renderIn(<SettingsGroup heading="Seating" settings={SEATING} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Seating' })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Seating' });
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Setting', 'Now', 'Who changes it', 'Changes to come', '']);
    const [, seatHold, priority] = within(table).getAllByRole('row');
    expect(cellsOf(seatHold ?? table)).toEqual(['Seat holdHow long a called seat waits', '20 minutes', 'Admins', '25 minutes from 16 Nov 2026', 'Change']);
    expect(cellsOf(priority ?? table)).toEqual(['Waitlist priorityWho is seated first', 'Black card first', 'Super admin', '–', '']);
    // DataTable's column of row buttons has no heading, here as on every console table: axe's one remark, and nothing else.
    expect(await axeViolations(container)).toEqual(['empty-table-header: Table header text should not be empty']);
  });

  it('opens a setting\'s change from its Change, named for the setting, and offers none to staff who may not change it', async () => {
    renderIn(<SettingsGroup heading="Seating" settings={SEATING} />);
    expect(screen.getAllByRole('button', { name: /^Change/ })).toHaveLength(1);
    const change = screen.getByRole('button', { name: 'Change Seat hold' });
    expect(change).toHaveTextContent('Change');
    change.focus();
    await userEvent.keyboard('{Enter}');
    expect(onSeatHold).toHaveBeenCalledTimes(1);
  });

  it('has nothing to sort or filter within a group, and no Export of its own', () => {
    renderIn(<DataTableExportProvider exporter={async () => true}><SettingsGroup heading="Seating" settings={SEATING} /></DataTableExportProvider>);
    expect(screen.queryByRole('button', { name: /sort and filter/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Export/ })).toBeNull();
  });

  it('says so in one line when the group has no settings', () => {
    renderIn(<SettingsGroup heading="Identity" settings={[]} />);
    expect(screen.getByRole('heading', { name: 'Identity' })).toBeInTheDocument();
    expect(screen.getByText('No settings.')).toBeInTheDocument();
  });
});
