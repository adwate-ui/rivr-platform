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
  { staffId: 's1', fullName: 'Ayesha Thomas', jobTitle: 'Floor manager', role: 'admin', phone: '+919000000150', isActive: true, isMe: true, hasLogin: true, lastSignedInAt: null },
  { staffId: 's2', fullName: 'Manoj Pillai', jobTitle: 'Cashier', role: 'cashier', phone: '+919000000151', isActive: true, isMe: false, hasLogin: true, lastSignedInAt: null },
  { staffId: 's3', fullName: 'Ravi Dealer', jobTitle: 'Dealer', role: 'dealer', phone: null, isActive: false, isMe: false, hasLogin: true, lastSignedInAt: null },
  { staffId: 's4', fullName: 'Neha Kapoor', jobTitle: 'Floor manager', role: 'admin', phone: '+919000000152', isActive: false, isMe: false, hasLogin: true, lastSignedInAt: null },
];

/** The table, with Ravi removed on 5 Nov by Vikram; a change sent to the staff table goes to `changes`. */
function renderTable(isAdding = false, view: StaffView = 'active', members: readonly StaffMember[] = STAFF) {
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
  const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
  const tree = (shown: StaffView) => (
    <RivrDataProvider client={client} queryClient={cache}>
      <ToastProvider place="console">
        <StaffTable venueId="v1" members={members} grantable={['cashier', 'dealer', 'host']} isAdding={isAdding} view={shown} />
      </ToastProvider>
    </RivrDataProvider>
  );
  const { rerender } = render(tree(view));
  return { changes, showView: (next: StaffView) => rerender(tree(next)) };
}

const person = (over: Partial<StaffMember>): StaffMember => ({
  staffId: 'x', fullName: 'X', jobTitle: 'Floor manager', role: 'admin', phone: '+919000000155', isActive: true, isMe: false, hasLogin: true, lastSignedInAt: null, ...over,
});
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

describe('who still has access (F-116)', () => {
  it('says when each login last signed in, and that a PIN dealer has none', () => {
    renderTable(false, 'active', [
      person({ staffId: 'a', fullName: 'Asha Rao', lastSignedInAt: '2026-11-01T10:00:00Z' }),
      person({ staffId: 'b', fullName: 'Bela Rao' }),
      // A mobile on file does not make a login: no login is the mark of a dealer on a PIN (decision 0046).
      person({ staffId: 'c', fullName: 'Chirag Rao', phone: '+919000000156', role: 'dealer', hasLogin: false }),
      person({ staffId: 'd', fullName: 'Dev Rao', role: 'dealer' }),
    ]);
    expect(screen.getByRole('columnheader', { name: /Last signed in/ })).toBeDefined();
    const row = (name: string) => screen.getByRole('button', { name }).closest('[role="row"]')?.textContent;
    expect(row('Asha Rao')).toContain('1 Nov 2026');
    expect(row('Bela Rao')).toContain('Never');
    expect(row('Chirag Rao')).toContain('PIN only');
    expect(row('Dev Rao')).toContain('Never');
  });

  it('narrows to logins not used in 30 days or ever, and leaves a PIN dealer out', () => {
    renderTable(false, 'active', [
      person({ staffId: 'a', fullName: 'Asha Rao', lastSignedInAt: daysAgo(29) }),
      person({ staffId: 'b', fullName: 'Bela Rao', lastSignedInAt: daysAgo(31) }),
      person({ staffId: 'c', fullName: 'Chirag Rao' }),
      person({ staffId: 'd', fullName: 'Dev Rao', phone: '+919000000157', role: 'dealer', hasLogin: false }),
      person({ staffId: 'e', fullName: 'Esha Rao', hasLogin: false }),
    ]);
    fireEvent.click(screen.getByRole('button', { name: /Not signed in for 30 days/ }));
    expect(screen.queryByRole('button', { name: 'Asha Rao' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dev Rao' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Esha Rao' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Bela Rao' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Chirag Rao' })).toBeDefined();
  });

  it('narrows only the staff working: on Removed staff the chip is gone and nobody is hidden by it', async () => {
    const { showView } = renderTable(false, 'active', [
      person({ staffId: 'a', fullName: 'Asha Rao' }),
      person({ staffId: 'b', fullName: 'Bela Rao', isActive: false, lastSignedInAt: daysAgo(1) }),
    ]);
    fireEvent.click(screen.getByRole('button', { name: /Not signed in for 30 days/ }));
    showView('removed');
    expect(await screen.findByRole('button', { name: 'Bela Rao' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Not signed in for 30 days/ })).toBeNull();
  });

  it('filters by the day of the last sign-in (decision 0512)', () => {
    renderTable(false, 'active', [person({ staffId: 'a', fullName: 'Asha Rao', lastSignedInAt: daysAgo(2) })]);
    fireEvent.click(screen.getByRole('button', { name: 'Last signed in: sort and filter' }));
    expect(screen.getByRole('radio', { name: 'Last 7 days' })).toBeDefined();
  });

  it('warns when more than five are super admins, and not at five', () => {
    const admins = (count: number) => Array.from({ length: count }, (_, at) => person({ staffId: `s${at}`, fullName: `Admin ${at}`, role: 'super_admin' }));
    renderTable(false, 'active', admins(6));
    expect(screen.getByText('6 people are super admins. Keep it to those who need it.')).toBeDefined();
    cleanup();
    renderTable(false, 'active', admins(5));
    expect(screen.queryByText(/people are super admins/)).toBeNull();
  });

  it('does not count or offer the filter on Removed staff', () => {
    renderTable(false, 'removed', Array.from({ length: 6 }, (_, at) => person({ staffId: `s${at}`, fullName: `Admin ${at}`, role: 'super_admin', isActive: false })));
    expect(screen.queryByText(/people are super admins/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Not signed in/ })).toBeNull();
  });
});

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
