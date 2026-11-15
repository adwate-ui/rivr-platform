import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BonusApprovals } from './BonusApprovals.tsx';
import { refused, renderWithApi, resetApi, type Reply } from './promotionsTestApi.tsx';

afterEach(resetApi);

/** A page row of bonus_waiting_page: Ishaan's play-time Bonus, unless changed. */
function waitingRow(more: Record<string, unknown>) {
  return {
    total: 3, grant_id: 'g1', member_id: 'm1', full_name: 'Ishaan Verma', member_number: 7, promotion_id: 'p1', promotion_name: 'Four-hour bonus',
    amount_paise: 100_000, trigger: 'hours_step', event_at: '2026-11-15T16:30:00Z', step_minutes: 240, table_name: null, club_day: '2026-11-15', ...more,
  };
}

const ROWS = [
  waitingRow({}),
  waitingRow({ grant_id: 'g2', member_id: 'm2', full_name: 'Vihaan Kapoor', member_number: 8, promotion_name: 'Seat bonus', amount_paise: 50_000,
    trigger: 'seated', step_minutes: null, table_name: 'Table 3' }),
  waitingRow({ grant_id: 'g3', member_id: 'm3', full_name: 'Mihir Shah', member_number: 9, promotion_name: 'Welcome', amount_paise: 50_000,
    trigger: 'signup', step_minutes: null }),
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
