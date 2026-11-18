import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CorrectSession } from './CorrectSession.tsx';
import { renderWithApi, resetApi } from './promotionsTestApi.tsx';

afterEach(resetApi);

// Ishaan's club day of 15 Nov (IST): in at 18:00 and out at 19:00; then in at 20:00, at Table 3 from 20:10 to 22:40:30 and
// some microseconds, as the server keeps a seat's end, and out at 23:00.
const FIRST = { visitId: 'v1', openedAt: '2026-11-15T12:30:00Z', closedAt: '2026-11-15T13:30:00Z', sessions: [] };
const SECOND = {
  visitId: 'v2', openedAt: '2026-11-15T14:30:00Z', closedAt: '2026-11-15T17:30:00Z',
  sessions: [{ sessionId: 's1', tableName: 'Table 3', startedAt: '2026-11-15T14:40:00Z', endedAt: '2026-11-15T17:10:30.123456+00:00', awaySeconds: 0 }],
};

const typeIn = (panel: HTMLElement, name: RegExp, value: string) => fireEvent.change(within(panel).getByRole('textbox', { name }), { target: { value } });

describe('Correct visit, on a club day of two visits (the owner, 18 Nov)', () => {
  it('corrects the visit chosen alone, and lets another be chosen only once nothing is left unsaved', async () => {
    const onDone = vi.fn();
    const { bodiesOf } = renderWithApi(
      <CorrectSession venueId="v1" memberId="m1" subtitle="Ishaan Verma · 15 Nov 2026" visits={[FIRST, SECOND]} onDone={onDone} onCancel={() => undefined} />,
      { '/rpc/correct_visit': { body: [{ refused: 0, given_above: 0 }] } },
    );
    const panel = await screen.findByRole('dialog', { name: 'Correct visit' });
    typeIn(panel, /^Checked in/, '17:45');
    expect(within(panel).getByText('Save or cancel to choose another visit.')).toBeDefined();
    fireEvent.click(within(panel).getByRole('radio', { name: '20:00 to 23:00' }));
    expect(within(panel).getByRole('textbox', { name: /^Checked in/ })).toHaveProperty('value', '17:45');
    typeIn(panel, /^Checked in/, '18:00');
    fireEvent.click(within(panel).getByRole('radio', { name: '20:00 to 23:00' }));
    expect(within(panel).getByRole('textbox', { name: /^Checked in/ })).toHaveProperty('value', '20:00');
    expect(within(panel).getByRole('textbox', { name: /^Left at/ })).toHaveProperty('value', '22:40');
    // Out at the minute the seat ended: the seat's own end, to the second.
    typeIn(panel, /^Checked out/, '22:40');
    typeIn(panel, /^Why it is corrected/, 'Left from the table');
    fireEvent.click(within(panel).getByRole('button', { name: 'Save correction' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(bodiesOf('correct_visit')).toEqual([{ p_visit_id: 'v2', p_seats: [], p_reason: 'Left from the table', p_closed_at: '2026-11-15T17:10:30.123456+00:00' }]);
  });
});
