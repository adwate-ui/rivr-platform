import { createRivrClient, RivrDataProvider, SESSION_STORAGE_KEY } from '@rivr/db';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoticesSection } from './NoticesSection.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const VENUE = '00000000-0000-4000-8000-000000000001';
const LIVE = { notice_id: 'n1', body: 'We\'re launching soon.', starts_at: '2026-11-02T10:00:00+00:00', ends_at: null };
// Far enough ahead to be still to come whenever the test runs.
const COMING = { notice_id: 'n2', body: 'Quiz night on Friday.', starts_at: '2099-11-14T13:30:00+00:00', ends_at: null };
type Reply = { status: number; body: unknown };

/**
 * Signed in as a super admin, with a live notice and one still to come; every call is kept with what it sent. A notice put
 * up joins the list from then on, starting as the call is made, as the database starts it.
 */
function renderNotices({ save = { status: 200, body: 'n3' } }: { save?: Reply } = {}) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000102', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  }));
  const calls: { url: string; body: unknown }[] = [];
  const list: unknown[] = [LIVE, COMING];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const body: unknown = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, body });
    if (url.includes('/rpc/venue_notices')) return Response.json(list);
    if (url.includes('/rpc/post_notice') && save.status === 200) {
      list.push({ notice_id: 'n3', body: String(Reflect.get(Object(body), 'p_body')), starts_at: new Date().toISOString(), ends_at: null });
    }
    if (url.includes('/rpc/post_notice') || url.includes('/rpc/update_notice')) return Response.json(save.body, { status: save.status });
    return Response.json(null);
  });
  render(
    <RivrDataProvider client={createRivrClient({ url: 'http://127.0.0.1:9', publishableKey: 'test' })}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NoticesSection venueId={VENUE} />
    </RivrDataProvider>,
  );
  return { calls, bodyOf: (rpc: string) => calls.find((call) => call.url.includes(`/rpc/${rpc}`))?.body };
}

const words = () => screen.getByRole('textbox', { name: 'Notice' });

describe('notices on Tonight, in Settings (decision 0424)', () => {
  it('lists each notice as members read it, when one still to come starts, and puts up a new one that shows as live', async () => {
    const { bodyOf } = renderNotices();
    expect(await screen.findByText('We\'re launching soon.')).toBeDefined();
    expect(screen.getByText('Starts 14 Nov 2099, 19:00 · Until ended')).toBeDefined();
    fireEvent.change(words(), { target: { value: 'Open till 4 tonight.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Put up' }));
    expect(await screen.findByText('Notice put up.')).toBeDefined();
    expect(bodyOf('post_notice')).toEqual({ p_venue_id: VENUE, p_body: 'Open till 4 tonight.' });
    // Up from now, it reads as live, not as still to come, however long the page has been open.
    const row = (await screen.findByText('Open till 4 tonight.')).closest('div')?.parentElement;
    expect(within(row ?? document.body).getByText('Until ended')).toBeDefined();
  });

  it('ends one', async () => {
    const { bodyOf } = renderNotices();
    fireEvent.click(await screen.findByRole('button', { name: 'End the notice: We\'re launching soon.' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, end it' }));
    await waitFor(() => expect(bodyOf('end_notice')).toEqual({ p_notice_id: 'n1' }));
    expect(await screen.findByText('Notice ended.')).toBeDefined();
  });

  it('shows the notice as members’ Tonight will, its card, line breaks and links, while it is typed', async () => {
    renderNotices();
    const preview = (await screen.findByText('On members’ Tonight')).parentElement;
    expect(within(preview ?? document.body).getByText('Your notice shows here.')).toBeDefined();
    fireEvent.change(words(), { target: { value: 'The Private Room opens at 20:00.\nDetails: https://rivrpoker.com/room' } });
    const card = within(preview ?? document.body).getByRole('article', { name: 'From the club' });
    expect(card.querySelectorAll('br')).toHaveLength(1);
    expect(within(card).getByRole('link', { name: 'rivrpoker.com/room' })).toBeDefined();
    // A preview, not news: it is not read out at every keystroke.
    expect(within(preview ?? document.body).queryByRole('status')).toBeNull();
  });

  it('counts the characters as the database does, an emoji as one', async () => {
    renderNotices();
    fireEvent.change(await screen.findByRole('textbox', { name: 'Notice' }), { target: { value: 'Hi 🙂' } });
    expect(screen.getByText(/4 of 500 characters\./)).toBeDefined();
  });

  it('puts one up for later, from an IST day and time to another', async () => {
    const { bodyOf } = renderNotices();
    fireEvent.change(await screen.findByRole('textbox', { name: 'Notice' }), { target: { value: 'Quiz night.' } });
    fireEvent.change(screen.getByLabelText('Starts on'), { target: { value: '2026-11-14' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Start time' }), { target: { value: '19:00' } });
    fireEvent.change(screen.getByLabelText('Ends on'), { target: { value: '2026-11-15' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'End time' }), { target: { value: '02:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Put up' }));
    expect(await screen.findByText('Notice put up.')).toBeDefined();
    expect(bodyOf('post_notice')).toEqual({
      p_venue_id: VENUE, p_body: 'Quiz night.', p_starts_at: '2026-11-14T13:30:00.000Z', p_ends_at: '2026-11-14T20:30:00.000Z',
    });
  });

  it('says on the field itself what is wrong with a day or a time, before anything is sent', async () => {
    const { calls } = renderNotices();
    const time = (name: string) => screen.getByRole('textbox', { name });
    fireEvent.change(await screen.findByRole('textbox', { name: 'Notice' }), { target: { value: 'Quiz night.' } });
    fireEvent.change(screen.getByLabelText('Starts on'), { target: { value: '2026-11-14' } });
    fireEvent.change(time('Start time'), { target: { value: '7pm' } });
    fireEvent.change(screen.getByLabelText('Ends on'), { target: { value: '2026-11-15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Put up' }));
    // Both at once, each under its own field: the start's time not as 19:00, and the end's day without a time.
    await waitFor(() => {
      expect(time('Start time').getAttribute('aria-invalid')).toBe('true');
      expect(time('End time').getAttribute('aria-invalid')).toBe('true');
    });
    expect(screen.getAllByText('A 24-hour time, as 19:00, with its day. Or clear both.')).toHaveLength(2);
    expect(calls.some((call) => call.url.includes('/rpc/post_notice'))).toBe(false);
  });

  it('edits the live notice in place, its words and its end, its start read only', async () => {
    const { bodyOf } = renderNotices({ save: { status: 200, body: null } });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit the notice: We\'re launching soon.' }));
    expect(words()).toHaveProperty('value', 'We\'re launching soon.');
    await waitFor(() => expect(document.activeElement).toBe(words()));
    expect(screen.getByLabelText('Starts on')).toHaveProperty('readOnly', true);
    expect(screen.getByText('Live, so its start stays.')).toBeDefined();
    fireEvent.change(words(), { target: { value: 'We open on Sunday 15 November.' } });
    fireEvent.change(screen.getByLabelText('Ends on'), { target: { value: '2026-11-15' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'End time' }), { target: { value: '02:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Notice saved.')).toBeDefined();
    expect(bodyOf('update_notice')).toEqual({ p_notice_id: 'n1', p_body: 'We open on Sunday 15 November.', p_ends_at: '2026-11-14T20:30:00.000Z' });
    expect(screen.getByRole('button', { name: 'Put up' })).toBeDefined();
  });

  it('marks a time not as 19:00 while editing, and saves nothing', async () => {
    const { calls } = renderNotices({ save: { status: 200, body: null } });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit the notice: We\'re launching soon.' }));
    fireEvent.change(screen.getByLabelText('Ends on'), { target: { value: '2026-11-15' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'End time' }), { target: { value: '7pm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'End time' }).getAttribute('aria-invalid')).toBe('true'));
    expect(calls.some((call) => call.url.includes('/rpc/update_notice'))).toBe(false);
  });

  it('edits one still to come: its start in IST, and cleared, it starts now', async () => {
    const { bodyOf } = renderNotices({ save: { status: 200, body: null } });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit the notice: Quiz night on Friday.' }));
    expect(screen.getByLabelText('Starts on')).toHaveProperty('value', '2099-11-14');
    expect(screen.getByRole('textbox', { name: 'Start time' })).toHaveProperty('value', '19:00');
    fireEvent.change(screen.getByLabelText('Starts on'), { target: { value: '' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Start time' }), { target: { value: '' } });
    const before = Date.now();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Notice saved.')).toBeDefined();
    const sent: unknown = bodyOf('update_notice');
    expect(sent).toMatchObject({ p_notice_id: 'n2' });
    expect(Date.parse(String(Reflect.get(Object(sent), 'p_starts_at')))).toBeGreaterThanOrEqual(before - 1000);
  });

  it('keeps the words to put up again when the notice ended while it was edited', async () => {
    renderNotices({ save: { status: 404, body: { code: 'P0002', message: 'ended' } } });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit the notice: Quiz night on Friday.' }));
    fireEvent.change(words(), { target: { value: 'Quiz night moves to Saturday.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('This notice has ended. Put up a new one.')).toBeDefined();
    expect(words()).toHaveProperty('value', 'Quiz night moves to Saturday.');
    expect(screen.getByRole('button', { name: 'Put up' })).toBeDefined();
  });

  it('clears the form when the notice being edited is ended', async () => {
    renderNotices();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit the notice: We\'re launching soon.' }));
    fireEvent.click(screen.getByRole('button', { name: 'End the notice: We\'re launching soon.' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, end it' }));
    expect(await screen.findByText('Notice ended.')).toBeDefined();
    expect(words()).toHaveProperty('value', '');
    expect(screen.getByRole('button', { name: 'Put up' })).toBeDefined();
  });

  it('lets an edit be left without saving, the focus back on the words', async () => {
    renderNotices();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit the notice: We\'re launching soon.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(words()).toHaveProperty('value', '');
    await waitFor(() => expect(document.activeElement).toBe(words()));
    expect(screen.getByRole('button', { name: 'Put up' })).toBeDefined();
  });

  it('says what to do when the notice is refused', async () => {
    renderNotices({ save: { status: 400, body: { code: '22023', message: 'too long' } } });
    fireEvent.change(await screen.findByRole('textbox', { name: 'Notice' }), { target: { value: 'x'.repeat(501) } });
    fireEvent.click(screen.getByRole('button', { name: 'Put up' }));
    expect(await screen.findByText('Write 1 to 500 characters, any link starting https://, and an end after the start and after now.')).toBeDefined();
  });
});
