import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderAs } from './membersTestKit.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const table = () => screen.findByRole('table', { name: 'Members' }, { timeout: 5000 });

/** Arjun's changes by staff: his ID check verified by Aditya, with the reason given. */
const CHANGES = {
  '/rpc/member_staff_history': () => [{
    id: 7, occurred_at: '2026-11-19T16:10:00Z', who: 'Aditya Malhotra', action: 'update', entity: 'kyc_record', reason: 'Checked at the desk',
    changes: [{ entity: 'kyc_record', field: 'status', before: 'needs_review', after: 'verified' }, { entity: 'kyc_record', field: 'pan', hidden: true }],
  }],
};

describe('History of changes by staff, from the Members table (the owner, 19 Nov)', () => {
  it('opens from a row\'s History icon at the side: what, who and when, each field before and after, and why', async () => {
    renderAs('floor', undefined, undefined, CHANGES);
    const list = await table();
    fireEvent.click(await within(list).findByRole('button', { name: 'History of Arjun Mehta' }));
    expect(await screen.findByText('Changed · ID check')).toBeDefined();
    expect(screen.getByText(/^Aditya Malhotra · 19 Nov 2026, 21:40$/)).toBeDefined();
    expect(screen.getByText('Status: Needs review → Verified')).toBeDefined();
    expect(screen.getByText('PAN changed')).toBeDefined();
    expect(screen.getByText('Reason: Checked at the desk')).toBeDefined();
  });

  it('says when staff changed nothing', async () => {
    renderAs('admin', undefined, undefined, { '/rpc/member_staff_history': () => [] });
    const list = await table();
    fireEvent.click(await within(list).findByRole('button', { name: 'History of Arjun Mehta' }));
    expect(await screen.findByText('No changes by staff.')).toBeDefined();
  });

  it('is not there for a host, who does not open the Door\'s History either', async () => {
    renderAs('host');
    const list = await table();
    expect(within(list).queryByRole('button', { name: /^History of/ })).toBeNull();
  });
});
