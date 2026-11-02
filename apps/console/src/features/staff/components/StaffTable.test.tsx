import { createRivrClient, RivrDataProvider, type StaffMember } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StaffTable } from './StaffTable.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const STAFF: readonly StaffMember[] = [
  { staffId: 's1', fullName: 'Ayesha Thomas', jobTitle: 'Floor manager', role: 'admin', phone: '+919000000150', isActive: true, isMe: true },
  { staffId: 's2', fullName: 'Manoj Pillai', jobTitle: 'Cashier', role: 'cashier', phone: '+919000000151', isActive: true, isMe: false },
  { staffId: 's3', fullName: 'Ravi Dealer', jobTitle: 'Dealer', role: 'dealer', phone: null, isActive: false, isMe: false },
];

function renderTable() {
  vi.stubGlobal('fetch', async () => Response.json([]));
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={cache}>
      <StaffTable venueId="v1" members={STAFF} grantable={['cashier', 'dealer', 'host']} />
    </RivrDataProvider>,
  );
}

describe('StaffTable', () => {
  it('lists the staff as a table, with You on one\'s own row, a dealer with no number and a login turned off', () => {
    renderTable();
    expect(screen.getByRole('button', { name: 'Ayesha Thomas · You' })).toBeDefined();
    expect(screen.getByText('No number')).toBeDefined();
    expect(screen.getByText('+91 90000 00151')).toBeDefined();
    expect(screen.getByText('Turned off')).toBeDefined();
  });

  it('narrows the table to what is typed in the search', () => {
    renderTable();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find staff' }), { target: { value: 'cashier' } });
    expect(screen.getByRole('button', { name: 'Manoj Pillai' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Ravi Dealer' })).toBeNull();
    // A number as the table shows it finds its row too.
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find staff' }), { target: { value: '90000 00151' } });
    expect(screen.getByRole('button', { name: 'Manoj Pillai' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Ayesha Thomas · You' })).toBeNull();
  });

  it('keeps the add form behind Add staff, and closes it again', () => {
    renderTable();
    expect(screen.queryByRole('textbox', { name: 'Full name' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add staff' }));
    expect(screen.getByRole('textbox', { name: 'Full name' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('textbox', { name: 'Full name' })).toBeNull();
  });

  it('opens a staff member beside the table, to change them, and closes them', () => {
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Manoj Pillai' }));
    expect(screen.getByRole('button', { name: 'Change Manoj Pillai' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Close Manoj Pillai' }));
    expect(screen.queryByRole('button', { name: 'Change Manoj Pillai' })).toBeNull();
  });
});
