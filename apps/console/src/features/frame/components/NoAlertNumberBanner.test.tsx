import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoAlertNumberBanner } from './NoAlertNumberBanner.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const WARNING = 'Alerts reach no one until alert emails are set up.';

/** The banner with this venue configuration; resolves once it has been read. */
async function renderBanner(detail: object | null, onAdd = vi.fn()) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  let isRead = false;
  vi.stubGlobal('fetch', async () => {
    isRead = true;
    return detail === null ? Response.json([]) : Response.json(detail);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NoAlertNumberBanner venueId="v1" onAdd={onAdd} />
    </RivrDataProvider>,
  );
  await waitFor(() => expect(isRead).toBe(true), { timeout: 5000 });
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
}

const DETAIL = {
  venue_id: 'v1', legal_name: 'RIVR Gaming Pvt Ltd', gstin: null, tan: 'DELR12345E', address: 'Gurugram', upi_payee_name: null, upi_vpa: null, bank_name: null,
  bank_account_name: null, bank_account_number: null, bank_ifsc: null, invoice_prefix: 'RIVR', staff_ip_allowlist: [], alert_whatsapp: null, logo_path: null,
  created_at: '', updated_at: '', sac_club_services: '999692', signatory_name: null, signatory_designation: null,
};

describe('The alert number warning (audit F-212)', () => {
  it('shows while the club has none, with the way to add it', async () => {
    const onAdd = vi.fn();
    await renderBanner(DETAIL, onAdd);
    expect(await screen.findByText(WARNING)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Set up alert emails' }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('still shows with only an alert number, as production has no WhatsApp, and with emails listed but off', async () => {
    await renderBanner({ ...DETAIL, alert_whatsapp: '+919876543210' });
    expect(await screen.findByText(WARNING)).toBeDefined();
    cleanup();
    await renderBanner({ ...DETAIL, alert_email_on: false, alert_emails: ['owner@example.com'] });
    expect(await screen.findByText(WARNING)).toBeDefined();
  });

  it('says nothing once alerts go by email, as on production, which has no WhatsApp', async () => {
    await renderBanner({ ...DETAIL, alert_email_on: true, alert_emails: ['owner@example.com'] });
    expect(screen.queryByText(WARNING)).toBeNull();
  });

  it('says nothing to someone the configuration is not read for', async () => {
    await renderBanner(null);
    expect(screen.queryByText(WARNING)).toBeNull();
  });
});
