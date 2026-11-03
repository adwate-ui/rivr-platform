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
    ['/purge', 'Purge', 'Not in your role. Ask an admin.'], ['/academy', 'Academy', 'This screen is switched off. Ask a super admin.'],
    ['/rewards?tab=spin-wheel', 'Rewards', 'Not in your role. Ask an admin.'],
  ])('refuses %s, opened by its address, under its name', async (path, title, text) => {
    signIn();
    answerStaff([CLUB]);
    renderAt(path);
    expect(await screen.findByText(text)).toBeDefined();
    expect(screen.getByRole('heading', { name: title, level: 1 })).toBeDefined();
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
    ['/tablets', 'Settings', 'Tablets'], ['/tvs', 'Settings', 'TVs'], ['/devices', 'Settings', 'Devices'], ['/games-history', 'Settings', 'Games history'],
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
    ['/computers', 'Computers are no longer on the console.'],
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
    fireEvent.click(screen.getByRole('button', { name: 'Sana Qureshi' }));
    expect(screen.getByRole('group', { name: 'Sana Qureshi' })).toBeDefined();
    expect(screen.getByText('Cashier · RIVR Gurugram')).toBeDefined();
  });

  it('switches to the practice venue and back, saying so across the top while there', async () => {
    signIn();
    answerStaff([CLUB, PRACTICE]);
    renderAt('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Sana Qureshi' }));
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
    fireEvent.click(await screen.findByRole('button', { name: 'Sana Qureshi' }));
    expect(screen.getByText('Cashier · RIVR Gurugram')).toBeDefined();
    expect(screen.queryByRole('switch', { name: 'Practice venue' })).toBeNull();
  });

  it('keeps the practice venue and its stripe after a reload, and goes back to the club from the stripe', async () => {
    signIn();
    answerStaff([CLUB, PRACTICE]);
    renderAt('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Sana Qureshi' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Practice venue' }));
    expect(await screen.findByRole('region', { name: 'Practice venue' })).toBeDefined();
    // A reload: the page starts again from what the device kept.
    cleanup();
    renderAt('/');
    const stripe = await screen.findByRole('region', { name: 'Practice venue' });
    fireEvent.click(within(stripe).getByRole('button', { name: 'Back to the club' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Practice venue' })).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Sana Qureshi' }));
    expect(screen.getByText('Cashier · RIVR Gurugram')).toBeDefined();
  });

  it('offers the density and the keys that work in the staff member’s menu', async () => {
    signIn();
    answerStaff([CLUB]);
    renderAt('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Sana Qureshi' }));
    const density = screen.getByRole('radiogroup', { name: 'Density' });
    expect(within(density).getByRole('radio', { name: 'Comfortable' }).getAttribute('aria-checked')).toBe('true');
    expect(within(density).getByRole('radio', { name: 'Compact' })).toBeDefined();
    expect(screen.getByRole('list', { name: 'Shortcuts' }).textContent).toBe('/SearchCtrl KSearchEscClose');
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
