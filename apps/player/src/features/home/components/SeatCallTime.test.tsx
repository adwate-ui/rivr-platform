import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FEATURES, LATER, NOW, renderTonight, SEAT } from './homeTestKit.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

// Set and Extend call time to a time on the clock, and the others at the table (the owner, 22 Nov). Apart from Home's own
// file to hold each to its size.
describe('Tonight › call time at the seat', () => {
  /** The Set or Extend sheet, opened from its round action, and its time field. */
  async function openCallTime(action: 'Set call time' | 'Extend call time') {
    fireEvent.click(await screen.findByRole('button', { name: action }, LATER));
    const sheet = within(await screen.findByRole('dialog', { name: action }));
    const pick = (time: string) => {
      fireEvent.change(sheet.getByLabelText('Until'), { target: { value: time } });
      fireEvent.click(sheet.getByRole('button', { name: action }));
    };
    return { sheet, until: sheet.getByLabelText('Until'), pick };
  }
  const setsUntil = (asked: readonly string[]) => asked.filter((call) => call.startsWith('set_my_call_time')).map((call) => /"p_until":"([^"]+)"/.exec(call)?.[1]);

  it('Set call time: a time on the clock after the minimum playing time; one before it is refused before anything is sent (the owner, 22 Nov)', async () => {
    // 2 h 41 min 8 s owed: the minimum ends at 01:25, and the field starts at the five minutes after.
    const { asked } = renderTonight([], [SEAT]);
    const { sheet, until, pick } = await openCallTime('Set call time');
    expect(until).toHaveProperty('value', '01:30');
    expect(sheet.getByText('After 01:25.')).toBeDefined();
    // Setting is not extending: no 'beyond the current end' (#1089).
    expect(sheet.queryByText('Extend adds time beyond the current end.')).toBeNull();
    pick('01:00');
    expect(await sheet.findByText('Pick a time after 01:25.')).toBeDefined();
    expect(setsUntil(asked)).toEqual([]);
    // 02:00 is the one past midnight, tonight's.
    pick('02:00');
    await vi.waitFor(() => expect(setsUntil(asked)).toEqual(['2026-11-15T20:30:00.000Z']));
  });

  it('Set call time once the minimum is met: any time ahead, and a time just gone by is refused (decision 0305)', async () => {
    const { asked } = renderTonight([], [{ ...SEAT, call_time_left: 0, call_time_ends_at: null, call_time_after_at: new Date(NOW).toISOString() }]);
    const { sheet, until, pick } = await openCallTime('Set call time');
    expect(until).toHaveProperty('value', '22:45');
    pick('22:00');
    expect(await sheet.findByText('Pick a time after 22:44.')).toBeDefined();
    pick('23:30');
    await vi.waitFor(() => expect(setsUntil(asked)).toEqual(['2026-11-15T18:00:00.000Z']));
  });

  it('Extend call time once set: a time later than the current end, sent as the member\'s own (the owner, 18 and 22 Nov)', async () => {
    // Set, and ending at 01:25 IST.
    const { asked } = renderTonight([], [{ ...SEAT, call_time_set_at: '2026-11-15T17:00:00Z' }]);
    const { sheet, pick } = await openCallTime('Extend call time');
    // Extend adds beyond the current end, and the field says so with the time to beat, as its description (#1089, #1099).
    const hint = sheet.getByText('After 01:25. Extend adds time beyond the current end.');
    expect(sheet.getByLabelText('Until').getAttribute('aria-describedby')).toBe(hint.id);
    pick('02:25');
    await vi.waitFor(() => expect(setsUntil(asked)).toEqual(['2026-11-15T20:55:00.000Z']));
  });

  it('Set call time keeps its request id for the same time after no answer, and takes a new one for another time', async () => {
    const { asked } = renderTonight([], [SEAT], { '/rpc/set_my_call_time': new Response(JSON.stringify({ code: 'XX000', message: 'lost' }), { status: 500 }) });
    const { pick } = await openCallTime('Set call time');
    const keys = () => asked.filter((call) => call.startsWith('set_my_call_time')).map((call) => /"p_idempotency_key":"([^"]+)"/.exec(call)?.[1]);
    pick('02:00');
    await vi.waitFor(() => expect(keys()).toHaveLength(1));
    pick('02:00');
    await vi.waitFor(() => expect(keys()).toHaveLength(2));
    pick('02:30');
    await vi.waitFor(() => expect(keys()).toHaveLength(3));
    const [first, again, other] = keys();
    expect(again).toBe(first);
    expect(other).not.toBe(first);
  });

  it('Seated: the others at the table, by seat, with their first name and call time (the owner, 22 Nov)', async () => {
    renderTonight([], [SEAT], { '/rpc/my_tablemates': [
      { seat: 2, first_name: 'Ritika', call_time: 'until', ends_at: '2026-11-15T18:10:00Z' },
      { seat: 5, first_name: null, call_time: 'not_set', ends_at: null },
      { seat: 7, first_name: 'Mihir', call_time: 'away', ends_at: null },
    ] });
    expect(await screen.findByText('At your table', {}, LATER)).toBeDefined();
    expect(screen.getByText('Seat 2 · Ritika')).toBeDefined();
    expect(screen.getByText('Until 23:40')).toBeDefined();
    expect(screen.getByText('Seat 5')).toBeDefined();
    expect(screen.getByText('Not set')).toBeDefined();
    expect(screen.getByText('Seat 7 · Mihir')).toBeDefined();
    expect(screen.getByText('Away')).toBeDefined();
  });

  it('Seated alone, or not seeing call time: no one at the table is listed', async () => {
    renderTonight([], [{ ...SEAT, call_time_left: null, call_time_minutes: null, call_time_ends_at: null, call_time_after_at: null }], {
      '/rpc/my_feature_access': FEATURES.filter((feature) => feature.feature_key !== 'call_time.view'),
      '/rpc/my_tablemates': [{ seat: 2, first_name: 'Ritika', call_time: 'until', ends_at: '2026-11-15T18:10:00Z' }],
    });
    await screen.findByRole('button', { name: 'Leave seat' }, LATER);
    expect(screen.queryByText('At your table')).toBeNull();
  });

});
