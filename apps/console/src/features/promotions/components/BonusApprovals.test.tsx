import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BonusApprovals } from './BonusApprovals.tsx';
import { refused, renderWithApi, resetApi, type Reply } from './promotionsTestApi.tsx';

afterEach(resetApi);

// Ishaan sat at Table 3 from 18:00 to 22:30 IST, 10 minutes away: 4 h 20 min played.
const SEAT = { id: 's1', table: 'Table 3', startedAt: '2026-11-15T12:30:00Z', endedAt: '2026-11-15T17:00:00Z', awaySeconds: 600 };
// Checked in at 17:50 and out at 22:40.
const VISIT = {
  visit_id: 'vis1', sessions: [SEAT], seated_at: SEAT.startedAt, left_at: SEAT.endedAt, away_seconds: 600, played_seconds: 15_600,
  visit_opened_at: '2026-11-15T12:20:00Z', visit_closed_at: '2026-11-15T17:10:00Z',
};
const NO_VISIT = {
  visit_id: null, sessions: null, seated_at: null, left_at: null, away_seconds: null, played_seconds: null, visit_opened_at: null, visit_closed_at: null,
};

/** A page row of bonus_waiting_page: Ishaan's play-time Bonus, unless changed. */
function waitingRow(more: Record<string, unknown>) {
  return {
    total: 3, grant_id: 'g1', member_id: 'm1', full_name: 'Ishaan Verma', member_number: 7, promotion_id: 'p1', promotion_name: 'Four-hour bonus',
    amount_paise: 100_000, trigger: 'hours_step', event_at: '2026-11-15T16:30:00Z', step_minutes: 240, table_name: null, club_day: '2026-11-15', ...VISIT, ...more,
  };
}

const ROWS = [
  waitingRow({}),
  waitingRow({ grant_id: 'g2', member_id: 'm2', full_name: 'Vihaan Kapoor', member_number: 8, promotion_name: 'Seat bonus', amount_paise: 50_000,
    trigger: 'seated', step_minutes: null, table_name: 'Table 3', ...NO_VISIT }),
  waitingRow({ grant_id: 'g3', member_id: 'm3', full_name: 'Mihir Shah', member_number: 9, promotion_name: 'Welcome', amount_paise: 50_000,
    trigger: 'signup', step_minutes: null, ...NO_VISIT }),
];

function renderQueue(replies: Readonly<Record<string, Reply>> = {}) {
  const onNavigate = vi.fn();
  const api = renderWithApi(<BonusApprovals venueId="v1" onNavigate={onNavigate} exportIn={null} />, {
    '/rpc/bonus_waiting_page': { body: ROWS },
    '/rpc/list_choices': { body: [{ column_key: 'promotion', value: 'Four-hour bonus', members: 1 }] },
    ...replies,
  });
  return { ...api, onNavigate };
}

const rowOf = async (name: string) => {
  const table = await screen.findByRole('table', { name: 'Bonus to approve' });
  return within(table).getAllByRole('row').find((row) => row.textContent?.includes(name)) ?? table;
};

describe('Bonus to approve (decision 0670)', () => {
  it('lists each Bonus waiting with its member, promotion, amount, why and when', async () => {
    renderQueue();
    const ishaan = await rowOf('Ishaan Verma');
    expect(ishaan.textContent).toContain('Ishaan Verma · No. 7');
    expect(ishaan.textContent).toContain('Four-hour bonus');
    expect(ishaan.textContent).toContain('1,000');
    expect(ishaan.textContent).toContain('4 h played');
    expect((await rowOf('Vihaan Kapoor')).textContent).toContain('Seat at Table 3');
    expect((await rowOf('Mihir Shah')).textContent).toContain('Sign-up');
  });

  it('approves one with a request id, and says how many and how much', async () => {
    const { bodiesOf } = renderQueue({ '/rpc/approve_promotion_bonus': { body: [{ decision_id: 'd1', grants: 1, amount_paise: 100_000 }] } });
    fireEvent.click(within(await rowOf('Ishaan Verma')).getByRole('button', { name: 'Approve 1,000 Bonus for Ishaan Verma' }));
    expect(await screen.findByText('1 approved · 1,000 Bonus')).toBeDefined();
    const [sent] = bodiesOf('approve_promotion_bonus');
    expect(sent).toMatchObject({ p_venue_id: 'v1', p_grant_ids: ['g1'] });
    expect(sent).toHaveProperty('p_request_id', expect.stringMatching(/^[0-9a-f-]{36}$/));
  });

  it('asks before approving all shown, with how many and how much, then approves them at once', async () => {
    const { bodiesOf } = renderQueue({ '/rpc/approve_promotion_bonus': { body: [{ decision_id: 'd1', grants: 3, amount_paise: 200_000, left_waiting: 0 }] } });
    await rowOf('Ishaan Verma');
    fireEvent.click(screen.getByRole('button', { name: 'Approve all shown' }));
    expect(await screen.findByText('Approve 3 · 2,000 Bonus?')).toBeDefined();
    expect(bodiesOf('approve_promotion_bonus')).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, approve 3' }));
    expect(await screen.findByText('3 approved · 2,000 Bonus')).toBeDefined();
    expect(bodiesOf('approve_promotion_bonus')[0]).toMatchObject({ p_grant_ids: ['g1', 'g2', 'g3'] });
  });

  it('asks before approving the ones ticked, and says how many a frozen member left waiting', async () => {
    const { bodiesOf } = renderQueue({ '/rpc/approve_promotion_bonus': { body: [{ decision_id: 'd1', grants: 1, amount_paise: 50_000, left_waiting: 1 }] } });
    fireEvent.click(within(await rowOf('Vihaan Kapoor')).getByRole('checkbox'));
    fireEvent.click(within(await rowOf('Mihir Shah')).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, approve 2' }));
    expect(await screen.findByText('1 approved · 500 Bonus · 1 left waiting (frozen)')).toBeDefined();
    expect(bodiesOf('approve_promotion_bonus')[0]).toMatchObject({ p_grant_ids: ['g2', 'g3'] });
  });

  it('keeps one request id for the same Bonus until it goes through', async () => {
    const { bodiesOf } = renderQueue({ '/rpc/approve_promotion_bonus': { status: 503, body: { message: 'unavailable' } } });
    const approveIshaan = async () => fireEvent.click(within(await rowOf('Ishaan Verma')).getByRole('button', { name: 'Approve 1,000 Bonus for Ishaan Verma' }));
    await approveIshaan();
    expect(await screen.findByText('Not saved. Try again.')).toBeDefined();
    await approveIshaan();
    await waitFor(() => expect(bodiesOf('approve_promotion_bonus')).toHaveLength(2));
    // The same Bonus and the same request id, twice.
    expect(new Set(bodiesOf('approve_promotion_bonus').map((body) => JSON.stringify(body))).size).toBe(1);
  });

  it('refuses the ones ticked with one reason, in the panel', async () => {
    const { bodiesOf } = renderQueue({ '/rpc/refuse_promotion_bonus': { body: [{ decision_id: 'd2', grants: 2, amount_paise: 100_000 }] } });
    fireEvent.click(within(await rowOf('Vihaan Kapoor')).getByRole('checkbox'));
    fireEvent.click(within(await rowOf('Mihir Shah')).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Refuse' }));
    const panel = await screen.findByRole('dialog', { name: 'Refuse 2' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Refuse 2' }));
    expect(await within(panel).findByText('Write a reason of 3 to 200 characters.')).toBeDefined();
    expect(bodiesOf('refuse_promotion_bonus')).toEqual([]);
    fireEvent.change(within(panel).getByRole('textbox', { name: /^Why it is refused/ }), { target: { value: 'Signed up twice' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Refuse 2' }));
    expect(await screen.findByText('2 refused')).toBeDefined();
    expect(bodiesOf('refuse_promotion_bonus')[0]).toMatchObject({ p_grant_ids: ['g2', 'g3'], p_reason: 'Signed up twice' });
  });

  it('says when a super admin tries their own record, and when another had decided them', async () => {
    renderQueue({ '/rpc/approve_promotion_bonus': refused('RVOWN') });
    fireEvent.click(within(await rowOf('Ishaan Verma')).getByRole('button', { name: 'Approve 1,000 Bonus for Ishaan Verma' }));
    expect(await screen.findByText('Not your own Bonus. Ask another super admin.')).toBeDefined();
    resetApi();
    renderQueue({ '/rpc/approve_promotion_bonus': { body: [{ decision_id: null, grants: 0, amount_paise: 0 }] } });
    fireEvent.click(within(await rowOf('Ishaan Verma')).getByRole('button', { name: 'Approve 1,000 Bonus for Ishaan Verma' }));
    expect(await screen.findByText('Already decided by another super admin.')).toBeDefined();
  });

  it('shows a play-time Bonus\'s seat, time away and time played; only it can be corrected', async () => {
    renderQueue();
    const ishaan = await rowOf('Ishaan Verma');
    expect(ishaan.textContent).toContain('18:00');
    expect(ishaan.textContent).toContain('22:30');
    expect(ishaan.textContent).toContain('10 min');
    expect(ishaan.textContent).toContain('4 h 20 min');
    expect(within(ishaan).getByRole('button', { name: 'Edit the visit of Ishaan Verma' })).toBeDefined();
    expect(within(await rowOf('Vihaan Kapoor')).queryByRole('button', { name: /^Edit/ })).toBeNull();
  });

  it('corrects when they left with a reason, in one call, and says what was refused and what given stays', async () => {
    const { bodiesOf } = renderQueue({ '/rpc/correct_visit': { body: [{ refused: 1, given_above: 1 }] } });
    fireEvent.click(within(await rowOf('Ishaan Verma')).getByRole('button', { name: 'Edit the visit of Ishaan Verma' }));
    const panel = await screen.findByRole('dialog', { name: 'Edit visit' });
    expect(within(panel).getByText('Table 3 · from 18:00')).toBeDefined();
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    expect(await within(panel).findByText('Change a time first.')).toBeDefined();
    fireEvent.change(within(panel).getByRole('textbox', { name: /^Left at/ }), { target: { value: '21:40' } });
    fireEvent.change(within(panel).getByRole('textbox', { name: /^Why it changes/ }), { target: { value: 'Left early, not checked out' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Visit edited · 1 waiting refused · 1 already given stays')).toBeDefined();
    // Time away left as it was keeps its seconds.
    expect(bodiesOf('correct_visit')).toEqual([
      { p_visit_id: 'vis1', p_seats: [{ sessionId: 's1', endedAt: '2026-11-15T16:10:00.000Z', awaySeconds: 600 }], p_reason: 'Left early, not checked out' },
    ]);
  });

  it('corrects time away alone, keeping when they left, and says when it is their own record', async () => {
    const { bodiesOf } = renderQueue({ '/rpc/correct_visit': refused('RVOWN') });
    fireEvent.click(within(await rowOf('Ishaan Verma')).getByRole('button', { name: 'Edit the visit of Ishaan Verma' }));
    const panel = await screen.findByRole('dialog', { name: 'Edit visit' });
    fireEvent.change(within(panel).getByRole('textbox', { name: /^Away/ }), { target: { value: '70' } });
    fireEvent.change(within(panel).getByRole('textbox', { name: /^Why it changes/ }), { target: { value: 'Away 70 minutes, not marked' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    expect(await within(panel).findByText('Not your own record. Ask another super admin.')).toBeDefined();
    expect(bodiesOf('correct_visit')).toEqual([{ p_visit_id: 'vis1', p_seats: [{ sessionId: 's1', endedAt: null, awaySeconds: 4200 }], p_reason: 'Away 70 minutes, not marked' }]);
  });

  it('corrects the visit\'s check-out with its seat, in the same call (the owner, 18 Nov)', async () => {
    const { bodiesOf } = renderQueue({ '/rpc/correct_visit': { body: [{ refused: 0, given_above: 0 }] } });
    fireEvent.click(within(await rowOf('Ishaan Verma')).getByRole('button', { name: 'Edit the visit of Ishaan Verma' }));
    const panel = await screen.findByRole('dialog', { name: 'Edit visit' });
    expect(within(panel).getByRole('textbox', { name: /^Checked in/ })).toHaveProperty('value', '17:50');
    fireEvent.change(within(panel).getByRole('textbox', { name: /^Checked out/ }), { target: { value: '22:10' } });
    fireEvent.change(within(panel).getByRole('textbox', { name: /^Left at/ }), { target: { value: '22:00' } });
    fireEvent.change(within(panel).getByRole('textbox', { name: /^Why it changes/ }), { target: { value: 'Card times' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Visit edited')).toBeDefined();
    expect(bodiesOf('correct_visit')).toEqual([{
      p_visit_id: 'vis1', p_seats: [{ sessionId: 's1', endedAt: '2026-11-15T16:30:00.000Z', awaySeconds: 600 }], p_reason: 'Card times', p_closed_at: '2026-11-15T16:40:00.000Z',
    }]);
  });

  it('says when nothing waits, and opens a member\'s record from a row', async () => {
    const { onNavigate } = renderQueue();
    fireEvent.click(within(await rowOf('Ishaan Verma')).getByRole('button', { name: /^Ishaan Verma/ }));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('/members?member=m1'));
    resetApi();
    renderQueue({ '/rpc/bonus_waiting_page': { body: [] } });
    expect(await screen.findByText('Nothing waits for approval.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Approve all shown' })).toBeNull();
  });
});
