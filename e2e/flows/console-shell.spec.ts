/**
 * Console shell (console v3, phase 1; decision 0476). The flow's own super admin opens every old address of a screen that
 * moved and lands on its new screen at its tab; the four tabs that are gone land on the screen that took their place and
 * say so in a line; a hidden screen is refused under its own name. The flow's own admin has Admin on the rail without the
 * danger screens, and is refused the purge by its address, under its name.
 */
import { expect, test, type Page } from '@playwright/test';
import { appUrl } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

/** An old address, where it lands, the rail's screen marked current (none for the phone's Requests), and the tab marked. */
const MOVED: readonly (readonly [string, string, string | null, string | null])[] = [
  ['/check-in', '/door?tab=check-in', 'Door', 'Check-in'],
  ['/players-today', '/door?tab=players', 'Door', 'Today’s players'],
  // Requests is one list, oldest first, with no tabs (decision 0479).
  ['/top-ups', '/requests', null, null],
  ['/time-requests', '/requests', null, null],
  ['/spin-wheel', '/rewards?tab=spin-wheel', 'Rewards', 'Spin wheel'],
  // The Waitlist's own tabs are the lead's (routes/waitlist.tsx): the address and the rail are this flow's to check.
  ['/tournament-interest', '/waitlist?tab=interest', 'Waitlist', null],
  ['/website', '/content?tab=website', 'Content', 'Website'],
  ['/learn-sources', '/content?tab=learn', 'Content', 'Learn content'],
  ['/devices', '/settings?tab=devices', 'Settings', 'Devices'],
  ['/tvs', '/settings?tab=devices&part=tvs', 'Settings', 'TVs'],
  ['/tablets', '/settings?tab=devices&part=tablets', 'Settings', 'Tablets'],
  ['/dealer-pins', '/staff?tab=dealerPins', 'Staff', 'Dealer PINs'],
];

/** Old addresses whose tab is gone: where they land, and the line that says so. */
const GONE: readonly (readonly [string, string, string])[] = [
  ['/rake', '/settings?notice=rake', 'Not used at RIVR.'],
  ['/cameras', '/settings?tab=devices&notice=cameras', 'Cameras are no longer on the console.'],
  ['/computers', '/settings?tab=devices&notice=computers', 'Computers are no longer on the console.'],
  ['/games-history', '/settings?notice=gamesHistory', 'Games history moved to Reports, Tables.'],
];

const where = (page: Page) => {
  const url = new URL(page.url());
  return `${url.pathname}${url.search}`;
};

const rail = (page: Page) => page.getByRole('navigation', { name: 'Sections' });

test.describe('Console shell', () => {
  test('Console shell: every old address opens its screen at its tab, and the gone ones say so', async ({ page }) => {
    test.setTimeout(120_000);
    await signInToConsole(page, '9000000192');
    await expect(page.getByRole('heading', { name: 'Live floor', level: 1 })).toBeVisible();
    for (const [old, to, screen, tab] of MOVED) {
      await page.goto(`${appUrl('console')}${old}`);
      await expect.poll(() => where(page), { message: old }).toBe(to);
      if (screen !== null) await expect(rail(page).getByRole('link', { name: screen, exact: true })).toHaveAttribute('aria-current', 'page');
      if (tab !== null) await expect(page.getByRole('main').getByRole('link', { name: tab, exact: true })).toHaveAttribute('aria-current', 'page');
    }
    for (const [old, to, notice] of GONE) {
      await page.goto(`${appUrl('console')}${old}`);
      await expect.poll(() => where(page), { message: old }).toBe(to);
      await expect(page.getByRole('main').getByText(notice)).toBeVisible();
      await expect(rail(page).getByRole('link', { name: 'Settings', exact: true })).toHaveAttribute('aria-current', 'page');
    }
    // A screen the owner hid is refused to a super admin too, under its own name, not "Console" (#811).
    await page.goto(`${appUrl('console')}/cage`);
    await expect(page.getByRole('heading', { name: 'Cage', level: 1 })).toBeVisible();
    await expect(page.getByText('Not used at RIVR.')).toBeVisible();
  });

  test('Console shell: an admin has Admin without the danger screens, and is refused the purge by its address', async ({ page }) => {
    await signInToConsole(page, '9000000197');
    await expect(page.getByRole('heading', { name: 'Live floor', level: 1 })).toBeVisible();
    for (const group of ['Tonight', 'Players', 'Marketing']) await expect(rail(page).getByText(group, { exact: true })).toBeVisible();
    await rail(page).getByRole('button', { name: 'Admin' }).click();
    for (const screen of ['Staff', 'Tables', 'Settings']) await expect(rail(page).getByRole('link', { name: screen, exact: true })).toBeVisible();
    for (const screen of ['Kill switch', 'Practice reset', 'Purge']) await expect(rail(page).getByRole('link', { name: screen })).toHaveCount(0);
    await page.goto(`${appUrl('console')}/purge`);
    await expect(page.getByRole('heading', { name: 'Purge', level: 1 })).toBeVisible();
    await expect(page.getByText('Not in your role. Ask an admin.')).toBeVisible();
  });
});
