import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOW, renderFloorScreen, seatRow, tableRow, type FloorApi } from './floorTestApi.tsx';
import { LiveFloorScreen } from './LiveFloorScreen.tsx';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// Kabir sits at Table 1 with no call time set; the minimum's end is at 00:00.
const FLOOR: FloorApi = {
  tables: [tableRow('t1', 'Table 1', { type: 'tt1' })],
  seats: [seatRow({ session: 's2', table: 't1', seat: 5, name: 'Kabir Sethi' })],
};

async function renderFloor(api: FloorApi) {
  const view = renderFloorScreen(LiveFloorScreen, api);
  await screen.findByRole('group', { name: 'Table 1 NLH 50/100' }, { timeout: 5000 });
  fireEvent.click(screen.getByRole('radio', { name: 'Seats' }));
  return view;
}

const sheet = (name: string) => screen.findByRole('dialog', { name });

describe("The floor's call time picker (the owner, 25 Nov)", () => {
  it('asks before a time earlier than usual or gone, and sets it on Yes with the same request id', async () => {
    // The database refuses either until it is sent confirmed (#1132).
    const refusal = (sent: unknown) => {
      if (Reflect.get(Object(sent), 'p_confirmed') === true) return undefined;
      const code = Reflect.get(Object(sent), 'p_until') === '2026-11-15T16:00:00.000Z' ? 'RVCTG' : 'RVCTE';
      return { status: 400, body: { code, message: 'confirm' } };
    };
    const { rpcs } = await renderFloor({ ...FLOOR, replies: { add_seat_call_time: refusal } });
    fireEvent.click(screen.getByRole('button', { name: /^Seat 5, Kabir Sethi/ }));
    const player = await sheet('Kabir Sethi');
    const until = within(player).getByLabelText('Until');
    // 23:00 has not reached the minimum's end at 00:00: asked, then set on Yes.
    fireEvent.change(until, { target: { value: '23:00' } });
    fireEvent.click(within(player).getByRole('button', { name: 'Set call time' }));
    expect(await within(player).findByText('23:00 is before 00:00. Set it anyway?')).toBeDefined();
    // The question comes with the database's answer, so it takes the focus, which reads it out.
    await waitFor(() => expect(within(player).getByRole('button', { name: 'Yes, set it' })).toHaveProperty('ownerDocument.activeElement', within(player).getByRole('button', { name: 'Yes, set it' })));
    fireEvent.click(within(player).getByRole('button', { name: 'Yes, set it' }));
    await screen.findByText('Kabir Sethi: call time set until 23:00');
    const [asked, confirmed] = rpcs('add_seat_call_time');
    expect(asked).not.toHaveProperty('p_confirmed');
    expect(confirmed).toMatchObject({ p_until: '2026-11-15T17:30:00.000Z', p_confirmed: true,
      p_idempotency_key: Reflect.get(Object(asked), 'p_idempotency_key') });
    // 21:30 has gone by: the call time ends now. Cancel sends nothing more.
    fireEvent.change(until, { target: { value: '21:30' } });
    fireEvent.click(within(player).getByRole('button', { name: 'Set call time' }));
    expect(await within(player).findByText('21:30 has gone. The call time ends now. Set it anyway?')).toBeDefined();
    fireEvent.click(within(player).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(within(player).queryByText(/has gone/)).toBeNull());
    expect(rpcs('add_seat_call_time')).toHaveLength(3);
  });
});
