import { createRivrClient, RivrDataProvider, type TableTypeRake } from '@rivr/db';
import { fromPaise } from '@rivr/domain/money';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RakeChangeForm } from './RakeChangeForm.tsx';

const TYPE: TableTypeRake = {
  tableTypeId: 't2', code: 'nlh_100_200', name: 'NLH 100/200', smallBlind: fromPaise(10000n), bigBlind: fromPaise(20000n),
  inForce: { settingId: 's1', rateBasisPoints: 500, cap: fromPaise(600000n), effectiveFrom: null, reason: 'Seed' }, scheduled: [],
};

/** The form on a fake API whose inserts answer with `status`; returns the rows inserted. */
function renderForm(status: number) {
  const inserted: unknown[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes('/rest/v1/setting') && init?.method === 'POST') {
      inserted.push(JSON.parse(String(init.body)));
      return status === 201 ? new Response(null, { status }) : Response.json({ code: '23514', message: 'past' }, { status });
    }
    return Response.json([]);
  });
  const client = createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' });
  render(<RivrDataProvider client={client}><RakeChangeForm venueId="v1" tableTypes={[TYPE]} /></RivrDataProvider>);
  return inserted;
}

function fill(label: string, value: string) {
  fireEvent.input(screen.getByLabelText(label), { target: { value } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('scheduling a rake change', () => {
  it('sends the change from its IST time, then clears the form', async () => {
    const inserted = renderForm(201);
    fireEvent.click(screen.getByRole('button', { name: 'NLH 100/200' }));
    fill('Rate (%)', '5');
    fill('Cap (₹)', '7000');
    fill('From', '2099-01-01');
    fill('At (IST)', '10:00');
    fill('Why it changes', 'Weekend cap');
    fireEvent.click(screen.getByRole('button', { name: 'Schedule the change' }));
    expect(await screen.findByText('Change scheduled.')).toBeDefined();
    expect(inserted).toEqual([{
      venue_id: 'v1', key: 'rake.config', subject: 'nlh_100_200', effective_from: '2099-01-01T10:00:00+05:30', reason: 'Weekend cap',
      value: { rate_basis_points: 500, cap_paise: 700000 },
    }]);
    await waitFor(() => expect(screen.getByRole('button', { name: 'NLH 100/200' }).getAttribute('aria-pressed')).toBe('false'));
    expect(screen.getByLabelText('Cap (₹)')).toHaveProperty('value', '');
  });

  it('asks for a table type and whole chips before sending, and sends no change for a time already past', async () => {
    const inserted = renderForm(400);
    fill('Cap (₹)', '7010');
    fireEvent.click(screen.getByRole('button', { name: 'Schedule the change' }));
    expect(await screen.findByText('Choose a table type.')).toBeDefined();
    expect(screen.getByText('Give a cap in whole ₹50 chips, up to ₹1,00,000.')).toBeDefined();
    expect(inserted).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'NLH 100/200' }));
    fill('Rate (%)', '5');
    fill('Cap (₹)', '7000');
    fill('From', '2020-01-01');
    fill('At (IST)', '10:00');
    fill('Why it changes', 'Too late');
    fireEvent.click(screen.getByRole('button', { name: 'Schedule the change' }));
    expect(await screen.findByText(/^That is too close to now: a hand may already be played under it\./)).toBeDefined();
    expect(inserted).toEqual([]);
  });
});
