import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { answerStaff, CLUB, LAZY_SCREEN, PRACTICE, renderAt, signIn } from './consoleTestApp.tsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

// The console v3 frame (phase 1): the rail for each role, refusals under the screen's name, old addresses that moved, the
// staff member's menu and the practice venue, and signing out when idle.
describe('the console frame', () => {
  // A screen outside the role is refused; one the club switched off says so rather than blaming the role (C-04).
  // Under the screen's own name, not "Console" (#811).
  it.each([
    ['/purge', 'Purge', 'Not in your role. Ask an admin.'], ['/academy', 'Academy', 'Not used at RIVR.'],
    ['/rewards?tab=spin-wheel', 'Spin wheel', 'Not in your role. Ask an admin.'],
  ])('refuses %s, opened by its address, under its name', async (path, title, text) => {
    signIn();
    answerStaff([CLUB]);
    renderAt(path);
    expect(await screen.findByText(text)).toBeDefined();
    expect(screen.getByRole('heading', { name: title, level: 1 })).toBeDefined();
  });

  it('offers a way back from a refusal, to the first screen the role has (audit F-106)', async () => {
    signIn();
    answerStaff([{ ...CLUB, full_name: 'Karan Gill', role: 'host' }]);
    renderAt('/settings');
    expect(await screen.findByRole('button', { name: 'Live floor' })).toBeDefined();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeDefined();
  });

  it.each(['owner_view', 'dealer'])('tells %s, with no screen on the console, so in plain words (owner, 8 Nov)', async (role) => {
    signIn();
    answerStaff([{ ...CLUB, full_name: 'Isha Rao', role }]);
    renderAt('/');
    expect(await screen.findByText('Nothing on the console for your role yet.')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'RIVR console', level: 1 })).toBeDefined();
    // Nothing that leads nowhere: not the name of a screen the role lacks, no search, no phone tab bar.
    expect(screen.queryByText('Live floor')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Search/ })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });

  it('says what a role can search for: no members for the floor, who do not open Members (audit F-037)', async () => {
    signIn();
    answerStaff([{ ...CLUB, full_name: 'Rohan Das', role: 'floor' }]);
    renderAt('/settings');
    expect(await screen.findByRole('button', { name: 'Search screens and actions' })).toBeDefined();
  });

  it('offers Seat a player to a host, who seats from the list without floor.manage (audit F-111)', async () => {
    signIn();
    answerStaff([{ ...CLUB, full_name: 'Karan Gill', role: 'host' }]);
    renderAt('/settings');
    fireEvent.click(await screen.findByRole('button', { name: 'Search members, screens, actions' }));
    const dialog = await screen.findByRole('dialog', { name: 'Search' });
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'seat' } });
    expect(await within(dialog).findByText('Seat a player')).toBeDefined();
  });

  it('gives a host no Marketing or Admin on the rail, and refuses Settings by its address', async () => {
    signIn();
    answerStaff([{ ...CLUB, full_name: 'Karan Gill', role: 'host' }]);
    renderAt('/settings');
    expect(await screen.findByText('Not in your role. Ask an admin.')).toBeDefined();
    const rail = screen.getByRole('navigation', { name: 'Sections' });
    expect(within(rail).getByRole('link', { name: 'Host queue' })).toBeDefined();
    for (const gone of ['Promotions', 'Rewards', 'Social', 'Content', 'Staff', 'Tables', 'Settings']) {
      expect(within(rail).queryByRole('link', { name: gone })).toBeNull();
    }
    expect(within(rail).queryByText('Marketing')).toBeNull();
    expect(within(rail).queryByText('Admin')).toBeNull();
  });

  it('gives an admin Admin with no danger screens, and refuses the purge by its address', async () => {
    signIn();
    answerStaff([{ ...CLUB, full_name: 'Aditya Malhotra', role: 'admin' }]);
    renderAt('/purge');
    expect(await screen.findByText('Not in your role. Ask an admin.')).toBeDefined();
    const rail = screen.getByRole('navigation', { name: 'Sections' });
    fireEvent.click(within(rail).getByRole('button', { name: 'Admin' }));
    expect(within(rail).getByRole('link', { name: 'Settings' })).toBeDefined();
    for (const gone of ['Kill switch', 'Practice reset', 'Purge']) expect(within(rail).queryByRole('link', { name: gone })).toBeNull();
  });

  // Screens merged into others (#606, console v3): each old address opens its screen on the rail, and its tab.
  it.each([
    ['/tablets', 'Settings', 'Tablets'], ['/tvs', 'Settings', 'TVs'], ['/devices', 'Settings', 'Devices'],
    ['/dealer-pins', 'Staff', 'Dealer PINs'], ['/check-in', 'Door', 'Check-in'], ['/players-today', 'Door', 'Today’s players'],
    ['/spin-wheel', 'Rewards', 'Spin wheel'], ['/website', 'Content', 'Website'], ['/learn-sources', 'Content', 'Learn content'],
  ])('opens %s on %s, at its tab, %s, for a super admin', async (path, rail, tab) => {
    signIn();
    answerStaff([{ ...CLUB, full_name: 'Vikram Rao', role: 'super_admin' }]);
    renderAt(path);
    expect(await screen.findByRole('link', { name: tab, current: 'page' }, LAZY_SCREEN)).toBeDefined();
    expect(within(screen.getByRole('navigation', { name: 'Sections' })).getByRole('link', { name: rail, current: 'page' })).toBeDefined();
  });

  // Their old tabs gone, these land on the screen that took their place, saying so (#811).
  it.each([
    ['/rake', 'Rake is no longer on the console.'], ['/cameras', 'Cameras are no longer on the console.'],
    ['/computers', 'Computers are no longer on the console.'], ['/games-history', 'Games history moved to Reports, Tables.'],
  ])('opens %s on Settings, saying %s', async (path, notice) => {
    signIn();
    answerStaff([{ ...CLUB, full_name: 'Vikram Rao', role: 'super_admin' }]);
    renderAt(path);
    expect(await screen.findByText(notice)).toBeDefined();
    expect(within(screen.getByRole('navigation', { name: 'Sections' })).getByRole('link', { name: 'Settings', current: 'page' })).toBeDefined();
  });

  it('opens on Live floor for staff, with the rail, who is signed in and the venue', async () => {
    signIn();
    answerStaff([CLUB, PRACTICE]);
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Live floor' })).toBeDefined();
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Live floor' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'SQ, Sana Qureshi' }));
    expect(screen.getByRole('group', { name: 'Sana Qureshi' })).toBeDefined();
    expect(screen.getByText('Cashier · RIVR Gurugram')).toBeDefined();
  });

  it('switches to the practice venue and back, saying so across the top while there', async () => {
    signIn();
    answerStaff([CLUB, PRACTICE]);
    renderAt('/');
    fireEvent.click(await screen.findByRole('button', { name: 'SQ, Sana Qureshi' }));
    expect(screen.getByRole('switch', { name: 'Practice venue' })).toBeDefined();
    expect(screen.queryByText('Practice venue: nothing here reaches the club or its members.')).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: 'Practice venue' }));
    expect(await screen.findByText('Cashier · RIVR Practice')).toBeDefined();
    expect(screen.getByText('Practice venue: nothing here reaches the club or its members.')).toBeDefined();
    fireEvent.click(screen.getByRole('switch', { name: 'Practice venue' }));
    expect(await screen.findByText('Cashier · RIVR Gurugram')).toBeDefined();
    expect(screen.queryByText('Practice venue: nothing here reaches the club or its members.')).toBeNull();
  });

  it('has no practice switch for someone who is staff at the club only', async () => {
    signIn();
    answerStaff([CLUB]);
    renderAt('/');
    fireEvent.click(await screen.findByRole('button', { name: 'SQ, Sana Qureshi' }));
    expect(screen.getByText('Cashier · RIVR Gurugram')).toBeDefined();
    expect(screen.queryByRole('switch', { name: 'Practice venue' })).toBeNull();
  });

  it('keeps the practice venue and its stripe after a reload, and goes back to the club from the stripe', async () => {
    signIn();
    answerStaff([CLUB, PRACTICE]);
    renderAt('/');
    fireEvent.click(await screen.findByRole('button', { name: 'SQ, Sana Qureshi' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Practice venue' }));
    expect(await screen.findByRole('region', { name: 'Practice venue' })).toBeDefined();
    // A reload: the page starts again from what the device kept.
    cleanup();
    renderAt('/');
    const stripe = await screen.findByRole('region', { name: 'Practice venue' });
    fireEvent.click(within(stripe).getByRole('button', { name: 'Back to the club' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Practice venue' })).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'SQ, Sana Qureshi' }));
    expect(screen.getByText('Cashier · RIVR Gurugram')).toBeDefined();
  });

  it('shows a role with one tab of a screen that tab alone, under its own title', async () => {
    signIn();
    answerStaff([{ ...CLUB, full_name: 'Isha Rao', role: 'marketing' }]);
    renderAt('/content');
    expect(await screen.findByRole('heading', { name: 'Website', level: 1 })).toBeDefined();
    expect(within(screen.getByRole('main')).queryByRole('navigation', { name: 'Content' })).toBeNull();
    expect(within(screen.getByRole('main')).queryByRole('heading', { name: 'Content' })).toBeNull();
  });

  it('offers the density and the keys that work in the staff member’s menu', async () => {
    signIn();
    answerStaff([CLUB]);
    renderAt('/');
    fireEvent.click(await screen.findByRole('button', { name: 'SQ, Sana Qureshi' }));
    const density = screen.getByRole('radiogroup', { name: 'Density' });
    expect(within(density).getByRole('radio', { name: 'Comfortable' }).getAttribute('aria-checked')).toBe('true');
    expect(within(density).getByRole('radio', { name: 'Compact' })).toBeDefined();
    expect(screen.getByRole('list', { name: 'Shortcuts' }).textContent).toBe('/SearchCtrl KSearchEscClose');
  });

  it('keeps single-key shortcuts off for a staff member who turned them off, and on again from the menu (WCAG 2.1.4)', async () => {
    signIn();
    const writes: unknown[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(String(input), init);
      if (request.url.includes('/rest/v1/staff_preference')) {
        if (request.method === 'GET') return Response.json({ has_shortcuts: false });
        writes.push(JSON.parse(await request.text()));
        return new Response(null, { status: 201 });
      }
      return request.url.includes('/rest/v1/staff') ? Response.json([CLUB]) : Response.json([]);
    });
    renderAt('/');
    fireEvent.click(await screen.findByRole('button', { name: 'SQ, Sana Qureshi' }));
    const toggle = screen.getByRole('switch', { name: 'Keyboard shortcuts' });
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('false'));
    expect(screen.getByRole('list', { name: 'Shortcuts' }).textContent).toBe('Ctrl KSearchEscClose');
    fireEvent.keyDown(document.body, { key: '/' });
    expect(screen.queryByRole('dialog', { name: 'Search' })).toBeNull();
    fireEvent.click(toggle);
    await waitFor(() => expect(writes).toEqual([[expect.objectContaining({ has_shortcuts: true })]]));
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
    fireEvent.keyDown(document.body, { key: '/' });
    expect(await screen.findByRole('dialog', { name: 'Search' })).toBeDefined();
  });

  it('says on sign-in that the idle lock signed the staff member out', async () => {
    signIn();
    answerStaff([{ ...CLUB, full_name: 'Kunal Desai', role: 'super_admin' }]);
    // The last activity on a screen that locks, eleven minutes ago: reopened, it locks at once.
    localStorage.setItem('rivr-cage-active-at', String(Date.now() - 11 * 60_000));
    renderAt('/members');
    expect(await screen.findByText('Signed out after ten idle minutes.', {}, LAZY_SCREEN)).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Mobile number' })).toBeDefined();
  });
});
