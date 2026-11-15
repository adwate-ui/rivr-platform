import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTableExportProvider } from '../DataTable/DataTableExport.tsx';
import { renderIn } from '../test/render.tsx';
import { SettingsGroups } from './SettingsGroups.tsx';

const GROUPS = [
  {
    heading: 'Seating',
    settings: [
      { key: 'seat_hold', name: 'Seat hold', line: 'How long a called seat is held', now: '20 minutes', who: 'Admins', toCome: '–' },
      { key: 'open_at', name: 'Open a game at', line: 'Players waiting before the floor is told', now: '6 players waiting', who: 'Admins', toCome: '–' },
    ],
  },
  { heading: 'Identity', settings: [{ key: 'kyc', name: 'Identity (KYC) checked at the club', line: 'Staff check Aadhaar and PAN at the desk', now: 'On', who: 'Super admin', toCome: '–' }] },
];

const headings = () => screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);

describe('SettingsGroups', () => {
  it('draws every group in order, with no count while nothing is searched', () => {
    renderIn(<SettingsGroups label="Settings" searchLabel="Find a setting" groups={GROUPS} />);
    expect(headings()).toEqual(['Seating', 'Identity']);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('narrows every group by a setting\'s name or its line, drops a group left empty, and says how many show', async () => {
    renderIn(<SettingsGroups label="Settings" searchLabel="Find a setting" groups={GROUPS} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find a setting' }), 'kyc');
    expect(headings()).toEqual(['Identity']);
    expect(screen.getByRole('status')).toHaveTextContent('1 of 3');
    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'the floor is told');
    expect(headings()).toEqual(['Seating']);
    expect(screen.getByText('Open a game at')).toBeInTheDocument();
    expect(screen.queryByText('Seat hold')).toBeNull();
  });

  it('says so in one line when the search finds no setting, and offers no Export of nothing', async () => {
    renderIn(<DataTableExportProvider exporter={async () => true}><SettingsGroups label="Settings" searchLabel="Find a setting" groups={GROUPS} /></DataTableExportProvider>);
    await userEvent.type(screen.getByRole('searchbox'), 'rake');
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    expect(screen.getByText('No settings.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export Settings' })).toBeNull();
  });

  it('exports the settings shown, of every group, as one recorded file, and offers no Export where staff may not', async () => {
    const exporter = vi.fn(async () => false);
    const { unmount } = renderIn(<DataTableExportProvider exporter={exporter}><SettingsGroups label="Settings" searchLabel="Find a setting" groups={GROUPS} /></DataTableExportProvider>);
    await userEvent.type(screen.getByRole('searchbox'), 'seat');
    await userEvent.click(screen.getByRole('button', { name: 'Export Settings' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Export CSV' }));
    expect(exporter).toHaveBeenCalledWith({ what: 'Settings', filter: 'Find a setting: seat', format: 'csv', rows: 1 });
    unmount();
    renderIn(<SettingsGroups label="Settings" searchLabel="Find a setting" groups={GROUPS} />);
    expect(screen.queryByRole('button', { name: 'Export Settings' })).toBeNull();
  });
});
