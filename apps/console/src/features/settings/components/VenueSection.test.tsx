import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VenueSection } from './VenueSection.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const DETAIL = {
  venue_id: 'v1', legal_name: 'RIVR Gaming Pvt Ltd', gstin: null, tan: null, address: 'Gurugram', upi_payee_name: null, upi_vpa: null, bank_name: null,
  bank_account_name: null, bank_account_number: null, bank_ifsc: null, invoice_prefix: 'RIVR', alert_whatsapp: null, logo_path: null,
  created_at: '', updated_at: '', sac_club_services: null, signatory_name: null, signatory_designation: null, contact_phone: null, contact_whatsapp: null,
  alert_email_on: false, alert_emails: [],
};

/** Settings > Club for a super admin, with what the server holds; `sent` keeps each save's body. */
function renderClub() {
  const sent: unknown[] = [];
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (init?.method === 'PATCH') {
      sent.push(JSON.parse(String(init.body)));
      return Response.json([{ venue_id: 'v1' }]);
    }
    return Response.json(url.includes('/venue_config_detail') ? DETAIL : []);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <VenueSection venueId="v1" />
    </RivrDataProvider>,
  );
  return { sent };
}

describe('Settings, Club: alerts by email too', () => {
  it('turns email alerts on with addresses one a line, and saves them', async () => {
    const { sent } = renderClub();
    const emailSwitch = await screen.findByRole('switch', { name: /Also send alerts by email/ });
    expect(emailSwitch.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(emailSwitch);
    expect(emailSwitch.getAttribute('aria-checked')).toBe('true');
    fireEvent.change(screen.getByRole('textbox', { name: /^Alert email addresses/ }), { target: { value: 'Owner@Rivr.in\ngm@rivr.in' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save configuration' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ alert_email_on: true, alert_emails: ['owner@rivr.in', 'gm@rivr.in'] });
  });

  it('refuses email alerts on with no address, before sending anything', async () => {
    const { sent } = renderClub();
    fireEvent.click(await screen.findByRole('switch', { name: /Also send alerts by email/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save configuration' }));
    expect(await screen.findByText('Up to five addresses, one a line. At least one while email alerts are on.')).toBeDefined();
    expect(sent).toEqual([]);
  });
});
