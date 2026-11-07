import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type StaffMember } from '@rivr/db';
import { ToastProvider } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StaffTable, type StaffView } from './StaffTable.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const STAFF: readonly StaffMember[] = [
  { staffId: 's1', fullName: 'Ayesha Thomas', jobTitle: 'Floor manager', role: 'admin', phone: '+919000000150', isActive: true, isMe: true },
  { staffId: 's2', fullName: 'Manoj Pillai', jobTitle: 'Cashier', role: 'cashier', phone: '+919000000151', isActive: true, isMe: false },
  { staffId: 's3', fullName: 'Ravi Dealer', jobTitle: 'Dealer', role: 'dealer', phone: null, isActive: false, isMe: false },
  { staffId: 's4', fullName: 'Neha Kapoor', jobTitle: 'Floor manager', role: 'admin', phone: '+919000000152', isActive: false, isMe: false },
];

/** The table, with Ravi removed on 5 Nov by Vikram; a change sent to the staff table goes to `changes`. */
function renderTable(isAdding = false, view: StaffView = 'active') {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const changes: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rpc/staff_removals')) return Response.json([{ staff_id: 's3', removed_at: '2026-11-05T12:00:00Z', removed_by: 'Vikram Rao' }]);
    if (url.includes('/rest/v1/staff') && init?.method === 'PATCH') {
      changes.push(JSON.parse(String(init.body)));
      return Response.json([{ id: 's3' }]);
    }
    return Response.json([]);
  });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })} queryClient={cache}>
      <ToastProvider place="console">
        <StaffTable venueId="v1" members={STAFF} grantable={['cashier', 'dealer', 'host']} isAdding={isAdding} view={view} />
      </ToastProvider>
    </RivrDataProvider>,
  );
  return { changes };
}

describe('StaffTable', () => {
  it('lists the staff working as a table, with You on one\'s own row; a removed login is not among them (owner, 8 Nov)', () => {
    renderTable();
    expect(screen.getByRole('button', { name: 'Ayesha Thomas · You' })).toBeDefined();
    expect(screen.getByText('+91 90000 00151')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Ravi Dealer' })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: /Login/ })).toBeNull();
  });

  it('lists the removed with when and by whom, and restores one after a second press', async () => {
    const { changes } = renderTable(false, 'removed');
    expect(await screen.findByText(/^5 Nov 2026 · by Vikram Rao$/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Ravi Dealer' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Ayesha Thomas · You' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Restore Ravi Dealer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, restore Ravi Dealer' }));
    await waitFor(() => expect(changes).toEqual([{ is_active: true }]));
    // An admin's role is beyond this manager's, so her row has no Restore, as it would have no changes; nor any record.
    expect(screen.getByRole('button', { name: 'Neha Kapoor' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Restore Neha Kapoor' })).toBeNull();
    expect(screen.getByText('Not recorded')).toBeDefined();
  });

  it('narrows the table to what is typed in the search', () => {
    renderTable();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find staff' }), { target: { value: 'cashier' } });
    expect(screen.getByRole('button', { name: 'Manoj Pillai' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Ayesha Thomas · You' })).toBeNull();
    // A number as the table shows it finds its row too.
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find staff' }), { target: { value: '90000 00151' } });
    expect(screen.getByRole('button', { name: 'Manoj Pillai' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Ayesha Thomas · You' })).toBeNull();
  });

  it('shows the add form above the table while Add staff has it open', () => {
    renderTable();
    expect(screen.queryByRole('textbox', { name: 'Full name' })).toBeNull();
    cleanup();
    renderTable(true);
    expect(screen.getByRole('textbox', { name: 'Full name' })).toBeDefined();
  });

  it('narrows the table by role, each role someone holds a chip with its count, and back with All', () => {
    renderTable();
    const roles = screen.getByRole('radiogroup', { name: 'Staff by role' });
    expect(Array.from(roles.querySelectorAll('[role="radio"]'), (chip) => chip.textContent)).toEqual(['All2', 'Admin1', 'Cashier1']);
    fireEvent.click(screen.getByRole('radio', { name: /^Cashier/ }));
    expect(screen.getByRole('button', { name: 'Manoj Pillai' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Ayesha Thomas · You' })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: /^All/ }));
    expect(screen.getByRole('button', { name: 'Ayesha Thomas · You' })).toBeDefined();
  });

  it('opens a staff member beside the table, to change them, and closes them', () => {
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'Manoj Pillai' }));
    expect(screen.getByRole('button', { name: 'Change Manoj Pillai' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Close Manoj Pillai' }));
    expect(screen.queryByRole('button', { name: 'Change Manoj Pillai' })).toBeNull();
  });
});
