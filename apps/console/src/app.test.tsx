import { SESSION_STORAGE_KEY } from '@rivr/db';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { answerOnceThenFail, answerStaff, CLUB, LAZY_SCREEN, renderAt, signIn } from './consoleTestApp.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});


/**
 * A fake Auth that accepts the code, and an API that fails linking the login to its staff record
 * once the test lets it answer: until then the person is signed in but still checking their code.
 */
function answerSignInThenFailLinking(): () => void {
  let answerLinking: () => void = () => undefined;
  const linking = new Promise<void>((resolve) => {
    answerLinking = resolve;
  });
  const session = {
    access_token: 'test',
    refresh_token: 'test',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-4000-8000-000000000104', aud: 'authenticated', role: 'authenticated', phone: '919876543210', app_metadata: {}, user_metadata: {}, created_at: '2026-10-18T00:00:00Z' },
  };
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('/auth/v1/otp')) return Response.json({});
    if (url.includes('/auth/v1/verify')) return Response.json(session);
    if (url.includes('/rpc/link_my_login')) {
      await linking;
      return Response.json({ message: 'unavailable' }, { status: 500 });
    }
    return Response.json([]);
  });
  return answerLinking;
}


describe('the console', () => {
  it('sends someone signed out to sign-in', async () => {
    renderAt('/');
    expect(await screen.findByRole('textbox', { name: 'Mobile number' }, LAZY_SCREEN)).toBeDefined();
  });

  it('shows in the rail only the screens the role allows, and none of the cage\'s, which are hidden', async () => {
    signIn();
    answerStaff([CLUB]);
    renderAt('/');
    expect(await screen.findByRole('link', { name: 'Live floor' })).toBeDefined();
    for (const hidden of ['Cage', 'Academy payments', 'Academy']) expect(screen.queryByRole('link', { name: hidden })).toBeNull();
    expect(screen.queryByRole('link', { name: 'KYC review' })).toBeNull();
  });

  it('and KYC review for an admin, but no Academy', async () => {
    signIn();
    answerStaff([{ ...CLUB, full_name: 'Aditya Malhotra', role: 'admin' }]);
    renderAt('/');
    expect(await screen.findByRole('link', { name: 'KYC review' })).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Academy' })).toBeNull();
  });

  // The old addresses of tabs the owner hid (#626): none opens its tab, a super admin's either.
  it.each([
    ['/computers', 'Computers'], ['/cameras', 'Cameras'], ['/high-hands', 'High hands'], ['/treasury', 'Opening and counts'],
    ['/end-of-day', 'Closing and history'], ['/rake', 'Rake and jackpots'],
  ])('does not open %s as its tab, %s, which is hidden', async (path, tab) => {
    signIn();
    answerStaff([{ ...CLUB, full_name: 'Vikram Rao', role: 'super_admin' }]);
    renderAt(path);
    expect(await screen.findByRole('link', { name: 'Live floor' })).toBeDefined();
    expect(screen.queryByRole('link', { name: tab })).toBeNull();
  });

  it.each(['/dealer-pins', '/tablets', '/computers'])('still refuses a dealer at %s, once it has opened the screen it moved to', async (path) => {
    signIn();
    answerStaff([{ ...CLUB, role: 'dealer' }]);
    renderAt(path);
    expect(await screen.findByText('Not in your role. Ask an admin.')).toBeDefined();
  });

  it('turns away someone who is not staff, who can only sign out', async () => {
    signIn();
    answerStaff([]);
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Staff only' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
    expect(screen.queryByRole('navigation', { name: 'Sections' })).toBeNull();
  });

  it('says so when the staff record cannot load, and still offers sign out', async () => {
    signIn();
    answerStaff([], 500);
    renderAt('/');
    expect(await screen.findByText('Not loaded. Try again.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
    // The rail is empty, not a search that found nothing.
    expect(screen.queryByText(/No screen by that name/)).toBeNull();
  });

  it('says who is signed in when sign-in is opened over a live session, instead of the form', async () => {
    signIn();
    answerStaff([CLUB]);
    renderAt('/sign-in');
    expect(await screen.findByText('Sana Qureshi is signed in on this device.', {}, LAZY_SCREEN)).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Mobile number' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue as Sana Qureshi' }));
    expect(await screen.findByRole('heading', { name: 'Live floor' })).toBeDefined();
  });

  it('never offers a way in before it knows whose console it is', async () => {
    signIn();
    answerStaff([], 500);
    renderAt('/sign-in');
    expect(await screen.findByText('Someone is signed in on this device.', {}, LAZY_SCREEN)).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Continue/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
  });

  it('never says someone is signed in while their own code is being checked', async () => {
    // The code is right, so Auth signs in, but linking the staff record fails and signs out again.
    const answerLinking = answerSignInThenFailLinking();
    renderAt('/sign-in');
    fireEvent.change(await screen.findByRole('textbox', { name: 'Mobile number' }, LAZY_SCREEN), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    // Six digits in, the code goes on by itself (S-01).
    fireEvent.change(await screen.findByRole('textbox', { name: /^Code sent to/ }), { target: { value: '123456' } });
    // Signed in by Auth while the staff record is still being linked: the code step stays.
    await waitFor(() => expect(localStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull());
    await new Promise((settle) => setTimeout(settle, 50));
    expect(screen.queryByText(/is signed in on this device/)).toBeNull();
    expect(screen.getByRole('textbox', { name: /^Code sent to/ })).toBeDefined();
    answerLinking();
    expect(await screen.findByText('Sign-in is down. Try again shortly.')).toBeDefined();
  });

  it('lets the next person sign in once the live session signs out', async () => {
    signIn();
    answerStaff([CLUB]);
    renderAt('/sign-in');
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }, LAZY_SCREEN));
    expect(await screen.findByRole('textbox', { name: 'Mobile number' })).toBeDefined();
  });

  it('says so when a page does not exist', async () => {
    signIn();
    answerStaff([CLUB]);
    renderAt('/nowhere');
    expect(await screen.findByText('This page is not here. Check the address, or go back.')).toBeDefined();
  });
});

describe('a screen whose refresh fails', () => {
  it('keeps Check-in, and the number typed in it, when a refresh fails, saying since when', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    signIn();
    answerOnceThenFail({ '/rpc/door_board': [] });
    renderAt('/door?tab=check-in');
    fireEvent.change(await screen.findByRole('textbox', { name: 'Card, mobile, number or name' }), { target: { value: '9876543210' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(await screen.findByText(/^Not updated since \d{2}:\d{2}\. Check the connection\.$/)).toBeDefined();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Card, mobile, number or name' }).value).toBe('9876543210');
    vi.useRealTimers();
  });

  it('keeps the Waitlist when a refresh fails, saying since when', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    signIn();
    answerOnceThenFail({
      '/rest/v1/game_table': [{ id: 't3', venue_id: 'v1', name: 'Table 3', is_open: true, seats: 9, position: 3, table_type_id: 'nl', must_move_to_table_id: null, room: 'main' }],
      '/rest/v1/table_type': [{ id: 'nl', name: 'NLH 100/200', small_blind_paise: 10000, big_blind_paise: 20000, buy_in_min_paise: 1000000, straddle_paise: null }],
      '/rpc/waitlist_board': [],
    });
    renderAt('/waitlist');
    expect((await screen.findAllByText(/NLH 100\/200/)).length).toBeGreaterThan(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(await screen.findByText(/^Not updated since /)).toBeDefined();
    expect(screen.getAllByText(/NLH 100\/200/).length).toBeGreaterThan(0);
    vi.useRealTimers();
  });
});
