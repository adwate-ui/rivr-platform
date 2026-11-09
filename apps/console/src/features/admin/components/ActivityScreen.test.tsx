import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, StaffVenueProvider } from '@rivr/db';
import { DataTableExportProvider, type TableExportRequest } from '@rivr/ui';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityScreen } from './ActivityScreen.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const line = (over: object) => ({
  id: 1, occurred_at: '2026-11-03T08:30:00Z', who: 'Vikram Rao', is_system: false, action: 'bonus.give', entity: 'member', kind: 'bonus_chips', about: 'Mihir Shah', reason: 'Welcome back', amount: 1500, ...over,
});
const LOADS = { timeout: 5000 };

/** Signed in as `role`, with activity_log answering `answer`; what each read asked for is kept, and each export's words. */
function renderScreen(role: 'super_admin' | 'owner_view', answer: (body: Record<string, unknown>) => object[]) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const asked: Record<string, unknown>[] = [];
  const exported: TableExportRequest[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/rest/v1/staff')) {
      return Response.json([{ id: 'st1', venue_id: 'v1', full_name: 'Vikram Rao', role, venue: { name: 'RIVR Gurugram', is_practice: false } }]);
    }
    if (!url.includes('/rpc/activity_log')) return Response.json([]);
    const body: unknown = JSON.parse(String(init?.body));
    const sent = typeof body === 'object' && body !== null ? Object.fromEntries(Object.entries(body)) : {};
    asked.push(sent);
    return Response.json(answer(sent));
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DataTableExportProvider exporter={async (request) => { exported.push(request); return false; }}>
        <StaffVenueProvider><ActivityScreen /></StaffVenueProvider>
      </DataTableExportProvider>
    </RivrDataProvider>,
  );
  return { asked, exported };
}

const exportCsv = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Export Activity' }, LOADS));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Export CSV' }));
};

describe('Activity (8 Nov audit, F-034)', () => {
  it('says who did what, how much, about whom, why and when, in words', async () => {
    renderScreen('super_admin', () => [
      line({}),
      line({ id: 2, who: null, is_system: true, action: 'update', entity: 'waitlist_entry', kind: 'floor', about: null, reason: null, amount: null }),
      line({ id: 3, who: null, is_system: false, action: 'made.up', entity: 'made_up', kind: 'other', about: null, reason: null, amount: null }),
      line({ id: 4, action: 'points.grant', kind: 'points', amount: 500 }),
    ]);
    const table = await screen.findByRole('table', { name: 'Activity' }, LOADS);
    const rows = await within(table).findAllByText('Member · Mihir Shah', {}, LOADS);
    const first = rows[0]?.closest('[role="row"]');
    for (const shown of ['Vikram Rao', 'Bonus chips', 'Gave bonus chips: 1,500', 'Welcome back']) expect(first?.textContent).toContain(shown);
    expect(rows[1]?.closest('[role="row"]')?.textContent).toContain('Gave points: 500');
    const second = within(table).getByText('Waitlist place').closest('[role="row"]');
    for (const shown of ['System', 'Floor', 'Changed']) expect(second?.textContent).toContain(shown);
    // A code from later on never reads as a code, and a login no longer on record is not called the system.
    const third = within(table).getByText('No longer on record').closest('[role="row"]');
    expect(third?.textContent).toContain('Recorded');
    expect(table.textContent).not.toContain('made');
  });

  it('asks the server for the person, kind and days chosen', async () => {
    const { asked } = renderScreen('super_admin', () => [line({})]);
    await screen.findByRole('table', { name: 'Activity' }, LOADS);
    await waitFor(() => expect(asked[0]).toEqual({ p_venue_id: 'v1', p_limit: 50 }));
    fireEvent.click(screen.getByRole('radio', { name: 'Exports' }));
    await waitFor(() => expect(asked.at(-1)).toEqual({ p_venue_id: 'v1', p_limit: 50, p_kind: 'exports' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Person' }), { target: { value: ' Vikram ' } });
    await waitFor(() => expect(asked.at(-1)).toEqual({ p_venue_id: 'v1', p_limit: 50, p_kind: 'exports', p_who: 'Vikram' }));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-11-03' } });
    await waitFor(() => expect(asked.at(-1)).toEqual({ p_venue_id: 'v1', p_limit: 50, p_kind: 'exports', p_who: 'Vikram', p_from: '2026-11-01', p_to: '2026-11-03' }));
  });

  const full = Array.from({ length: 50 }, (_, index) => line({ id: 100 - index, occurred_at: '2026-11-03T08:30:00Z' }));

  it('reads the next page from after the last line, while there is one', async () => {
    const { asked } = renderScreen('super_admin', (body) => (body['p_before_id'] === undefined ? full : [line({ id: 7, about: 'Kunal Mehra' })]));
    fireEvent.click(await screen.findByRole('button', { name: 'Show earlier' }, LOADS));
    await screen.findByText('Member · Kunal Mehra', {}, LOADS);
    expect(asked.at(-1)).toEqual({ p_venue_id: 'v1', p_limit: 50, p_before: '2026-11-03T08:30:00Z', p_before_id: 51 });
    expect(screen.queryByRole('button', { name: 'Show earlier' })).toBeNull();
  });

  it('records an export as partial while earlier lines are not loaded, and as whole once they are', async () => {
    const { exported } = renderScreen('super_admin', (body) => (body['p_before_id'] === undefined ? full : [line({ id: 7, about: 'Kunal Mehra' })]));
    await screen.findByRole('button', { name: 'Show earlier' }, LOADS);
    await exportCsv();
    await waitFor(() => expect(exported).toHaveLength(1));
    expect(exported[0]?.filter).toContain('Partial: the latest 50 lines only');
    fireEvent.click(screen.getByRole('button', { name: 'Show earlier' }));
    await screen.findByText('Member · Kunal Mehra', {}, LOADS);
    await exportCsv();
    await waitFor(() => expect(exported).toHaveLength(2));
    expect(exported[1]?.filter).not.toContain('Partial');
  });

  it('says so when nothing matches', async () => {
    renderScreen('super_admin', () => []);
    expect(await screen.findByText('Nothing recorded for this choice.', {}, LOADS)).toBeDefined();
  });

  it('refuses anyone else, an investor who holds audit.read too', async () => {
    const { asked } = renderScreen('owner_view', () => [line({})]);
    expect(await screen.findByText('Only a super admin reads the activity log.', {}, LOADS)).toBeDefined();
    expect(screen.queryByRole('table')).toBeNull();
    expect(asked).toEqual([]);
  });
});
