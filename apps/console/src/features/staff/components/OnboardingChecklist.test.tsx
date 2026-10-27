import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY, type StaffMember } from '@rivr/db';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OnboardingChecklist } from './OnboardingChecklist.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const SANA: StaffMember = {
  staffId: 'st1', fullName: 'Sana Qureshi', jobTitle: 'Cashier', role: 'cashier', phone: '+919000000104', isActive: true, isMe: false,
};
const CAGE = { staff_id: 'st1', sop_id: 's1', title: 'Cage', version_id: 'v1', version: 2, acknowledged_at: '2026-10-21T08:30:00+00:00' };
const AML = { staff_id: 'st1', sop_id: 's2', title: 'Anti-money laundering', version_id: 'v2', version: 1, acknowledged_at: null };
const DEALER = { staff_id: 'st2', sop_id: 's3', title: 'Dealer certification', version_id: 'v3', version: 1, acknowledged_at: null };

/** Aditya, an admin, signed in, and a fake API answering the venue's checklists. */
function renderChecklist(member: StaffMember, rows: unknown[]) {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-000000000103', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
    }),
  );
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    return Response.json(url.includes('/rpc/onboarding_checklists') ? rows : []);
  });
  const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
  render(<RivrDataProvider client={client}><OnboardingChecklist venueId="v1" member={member} /></RivrDataProvider>);
}

describe('OnboardingChecklist (decision 0212)', () => {
  it('says how many of the hire\'s SOPs they have acknowledged', async () => {
    renderChecklist(SANA, [CAGE, AML, DEALER]);
    expect(await screen.findByText('Onboarding: 1 of 2 SOPs acknowledged.')).toBeDefined();
  });

  it('opens the checklist: each SOP ticked with when, or not yet, and closes it again', async () => {
    renderChecklist(SANA, [CAGE, AML, DEALER]);
    fireEvent.click(await screen.findByRole('button', { name: 'Onboarding checklist for Sana Qureshi' }));
    const table = await screen.findByRole('table', { name: 'Onboarding checklist for Sana Qureshi' });
    expect(within(table).getByRole('row', { name: /Cage/ }).textContent).toMatch(/21 Oct 2026, 14:00/);
    expect(within(table).getByRole('row', { name: /Anti-money laundering/ }).textContent).toContain('Not yet');
    expect(within(table).queryByText('Dealer certification')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Hide onboarding checklist for Sana Qureshi' }));
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('says when no SOP in force asks the hire\'s role, with no checklist to open', async () => {
    renderChecklist(SANA, [DEALER]);
    expect(await screen.findByText('No SOP in force asks this role.')).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
