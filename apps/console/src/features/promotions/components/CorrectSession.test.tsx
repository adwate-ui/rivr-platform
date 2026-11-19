import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CorrectSession } from './CorrectSession.tsx';
import { refused, renderWithApi, resetApi } from './promotionsTestApi.tsx';

afterEach(resetApi);

// Ishaan's club day of 15 Nov (IST): in at 18:00 and out at 19:00; then in at 20:00, at Table 3 from 20:10 to 22:40:30 and
// some microseconds, as the server keeps a seat's end, and out at 23:00.
const FIRST = { visitId: 'v1', openedAt: '2026-11-15T12:30:00Z', closedAt: '2026-11-15T13:30:00Z', sessions: [] };
const SECOND = {
  visitId: 'v2', openedAt: '2026-11-15T14:30:00Z', closedAt: '2026-11-15T17:30:00Z',
  sessions: [{ sessionId: 's1', tableName: 'Table 3', startedAt: '2026-11-15T14:40:00Z', endedAt: '2026-11-15T17:10:30.123456+00:00', awaySeconds: 0 }],
};

const typeIn = (panel: HTMLElement, name: RegExp, value: string) => fireEvent.change(within(panel).getByRole('textbox', { name }), { target: { value } });

describe('Edit visit, on a club day of two visits (the owner, 18 Nov; Edit, 19 Nov)', () => {
  it('corrects the visit chosen alone, and lets another be chosen only once nothing is left unsaved', async () => {
    const onDone = vi.fn();
    const { bodiesOf } = renderWithApi(
      <CorrectSession venueId="v1" memberId="m1" subtitle="Ishaan Verma · 15 Nov 2026" visits={[FIRST, SECOND]} onDone={onDone} onCancel={() => undefined} />,
      { '/rpc/correct_visit': { body: [{ refused: 0, given_above: 0 }] } },
    );
    const panel = await screen.findByRole('dialog', { name: 'Edit visit' });
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
    typeIn(panel, /^Why it changes/, 'Left from the table');
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(bodiesOf('correct_visit')).toEqual([{ p_visit_id: 'v2', p_seats: [], p_reason: 'Left from the table', p_closed_at: '2026-11-15T17:10:30.123456+00:00' }]);
  });

  it('reads the line under the visits with the dimmed chips while there are changes not saved', async () => {
    renderWithApi(<CorrectSession venueId="v1" memberId="m1" subtitle="Ishaan Verma · 15 Nov 2026" visits={[FIRST, SECOND]} onDone={() => undefined} onCancel={() => undefined} />, {});
    const panel = await screen.findByRole('dialog', { name: 'Edit visit' });
    const chips = within(panel).getByRole('radiogroup', { name: 'Visit' });
    expect(chips.getAttribute('aria-describedby')).toBeNull();
    typeIn(panel, /^Checked in/, '17:45');
    const line = document.getElementById(chips.getAttribute('aria-describedby') ?? '');
    expect(line?.textContent).toBe('Save or cancel to choose another visit.');
  });
});

describe('Edit visit says which rule refused a correction (the review of the pull request for Edit visit)', () => {
  // The second visit alone: in at 20:00, at Table 3 from 20:10 to 22:40:30, out at 23:00.
  const open = async (replies: Parameters<typeof renderWithApi>[1]) => {
    const { bodiesOf } = renderWithApi(<CorrectSession venueId="v1" memberId="m1" subtitle="Ishaan Verma · 15 Nov 2026" visits={[SECOND]} onDone={() => undefined} onCancel={() => undefined} />, replies);
    return { bodiesOf, panel: await screen.findByRole('dialog', { name: 'Edit visit' }) };
  };

  it('says under each field which rule its time breaks, and sends nothing', async () => {
    const { bodiesOf, panel } = await open({});
    typeIn(panel, /^Checked in/, '20:15');
    typeIn(panel, /^Checked out/, '22:30');
    typeIn(panel, /^Why it changes/, 'Card times');
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    expect(await within(panel).findByText('The first seat started at 20:10. Check in by then.')).toBeDefined();
    expect(within(panel).getByText('The last seat ended at 22:40. Check out then or later.')).toBeDefined();
    expect(bodiesOf('correct_visit')).toEqual([]);
  });

  it('counts a seat end typed in the panel, and holds check-out to the club day', async () => {
    const { panel } = await open({});
    typeIn(panel, /^Left at/, '23:10');
    typeIn(panel, /^Checked out/, '06:30');
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    expect(await within(panel).findByText('The club day ends at 06:00.')).toBeDefined();
    typeIn(panel, /^Checked out/, '23:05');
    expect(within(panel).getByText('The last seat ended at 23:10. Check out then or later.')).toBeDefined();
  });

  it('names a clash with the member\'s other visit as its own refusal', async () => {
    const { panel } = await open({ '/rpc/correct_visit': refused('RVVCL') });
    typeIn(panel, /^Checked in/, '19:00');
    typeIn(panel, /^Why it changes/, 'Came in earlier');
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    expect(await within(panel).findByText('Those times run into their other visit.')).toBeDefined();
  });
});
