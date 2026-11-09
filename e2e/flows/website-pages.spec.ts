/**
 * Website pages (#35; decision 0166): the policies are in every page's footer and the club's pages in the
 * navigation, and each draws its blocks: house rules as a numbered list, questions that open to their
 * answers, how to find the club with a link to directions, responsible play, and the privacy notice with
 * its backups (#386); about, membership with the points the rules in force give (#617), the live promotions, and a
 * journal article from the journal's list. A visitor answers the cookie banner first, as it covers the foot of the page. The front page shows the games and the calendar, live.
 */
import { expect, test } from '@playwright/test';
import { appUrl, VIEWPORT } from '../support/apps.ts';

test.describe('Website', () => {
  test('the information pages: house rules, questions, visit, responsible play and privacy', { tag: '@staging' }, async ({ page }) => {
    await page.setViewportSize(VIEWPORT.web);
    await page.goto(`${appUrl('web')}/?ref=FRIEND1`);
    await page.getByRole('button', { name: 'Essential only' }).click();
    const site = page.getByRole('navigation', { name: 'Site' });
    const footer = page.getByRole('contentinfo');

    await footer.getByRole('link', { name: 'House rules' }).click();
    await expect(page).toHaveURL(/\/house-rules\?ref=FRIEND1$/);
    await expect(page.getByRole('heading', { level: 1, name: 'House rules' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('listitem').first()).toHaveText(/^Members only, 18 and over\./);

    await footer.getByRole('link', { name: 'Questions' }).click();
    await page.getByText('Who can join?').click();
    await expect(page.getByText(/^Anyone 18 or over\./)).toBeVisible();

    await site.getByRole('link', { name: 'Visit and contact' }).click();
    await expect(page.getByText('Upper floor, Glaza, M3M 65th Avenue, Sector 65, Gurugram')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get directions' })).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\//);

    await footer.getByRole('link', { name: 'Responsible play' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Responsible play' })).toBeVisible();

    // The privacy notice says how long backups keep personal data, and that erasures outlast a restore (#386).
    await footer.getByRole('link', { name: 'Privacy' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();
    await expect(page.getByText(/Personal data can be in a backup for up to 400 days\./)).toBeVisible();
    await expect(page.getByText(/every erasure made since it was taken is made again/)).toBeVisible();
  });

  test('at 1440 px the photo tiles’ titles share a line, and Visit has its map beside the way to reach the club', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.web);
    await page.goto(appUrl('web'));
    const gallery = page.locator('section', { has: page.getByRole('heading', { level: 2, name: 'Built for the long session.' }) });
    const tops = await gallery.getByRole('heading', { level: 3 }).evaluateAll((titles) => titles.map((title) => Math.round(title.getBoundingClientRect().top)));
    expect(tops).toHaveLength(8);
    expect(new Set(tops.slice(0, 4)).size).toBe(1);
    expect(new Set(tops.slice(4)).size).toBe(1);

    await page.goto(`${appUrl('web')}/visit`);
    const main = page.getByRole('main');
    await expect(main.getByRole('link', { name: /^Call / })).toHaveAttribute('href', /^tel:\+91\d{10}$/);
    await expect(main.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/91\d{10}$/);
    const details = await main.locator('address').boundingBox();
    const map = await main.locator('[data-consent="maps"]').boundingBox();
    expect(map?.x ?? 0).toBeGreaterThanOrEqual((details?.x ?? 0) + (details?.width ?? 0));
    expect(map?.height ?? 0).toBeGreaterThan(400);
  });

  test('a page names the club in its title, the front page and Visit describe it to search engines, and Skip to content passes the header', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.web);
    const described = page.locator('script[type="application/ld+json"]');

    await page.goto(appUrl('web'));
    await expect(page).toHaveTitle('RIVR Poker Club, Gurugram');
    await expect(described).toHaveCount(1);

    await page.goto(`${appUrl('web')}/membership`);
    await expect(page).toHaveTitle('Membership · RIVR Poker Club, Gurugram');
    await expect(described).toHaveCount(0);

    await page.goto(`${appUrl('web')}/visit`);
    await expect(page).toHaveTitle('Visit · RIVR Poker Club, Gurugram');
    expect(JSON.parse(await described.textContent() ?? '')).toMatchObject({ '@type': 'LocalBusiness', name: 'RIVR Poker Club', telephone: '+918796580435' });

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
  });

  test('the club’s pages: about, membership, promotions, and a journal article, each keeping the visitor’s codes', { tag: '@staging' }, async ({ page }) => {
    await page.setViewportSize(VIEWPORT.web);
    await page.goto(`${appUrl('web')}/?ref=FRIEND1`);
    await page.getByRole('button', { name: 'Essential only' }).click();
    const site = page.getByRole('navigation', { name: 'Site' });

    await site.getByRole('link', { name: 'The club' }).click();
    await expect(page).toHaveURL(/\/about\?ref=FRIEND1$/);
    await expect(page.getByRole('heading', { level: 1, name: 'About RIVR' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Poker is a game of skill.' })).toBeVisible();
    await expect(page.getByText('K.R. Lakshmanan v. State of Tamil Nadu')).toBeVisible();

    await site.getByRole('link', { name: 'Membership' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'RIVR membership' })).toBeVisible();
    // The points are the rules in force, not words in the page: points by hand only (#629), so none by table or rake.
    await expect(page.getByRole('row', { name: /Private Room/ })).toHaveCount(0);
    await expect(page.getByText(/of your rake comes back as points/)).toHaveCount(0);

    // The referral runs everywhere. Staging's percentage buy-in bonus stopped with 20261110130000_seat_bonus.sql.
    await site.getByRole('link', { name: 'Prizes and calendar' }).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Referral' })).toBeVisible();

    await site.getByRole('link', { name: 'Journal' }).click();
    await page.getByRole('main').getByRole('link', { name: "Read: Texas Hold'em for beginners" }).click();
    await expect(page).toHaveURL(/\/journal-holdem-basics\?ref=FRIEND1$/);
    await expect(page.getByRole('heading', { level: 1, name: "Texas Hold'em for beginners" })).toBeVisible();
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Terms of use' })).toHaveAttribute('href', '/terms?ref=FRIEND1');
  });

  test('the front page shows the games and stakes and the tournament calendar, live from the club', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.web);
    await page.goto(appUrl('web'));
    await expect(page.getByRole('heading', { level: 2, name: 'Pick your table.' })).toBeVisible();
    await expect(page.getByText('NLH 50/100', { exact: true })).toBeVisible();
    await expect(page.getByText('Buy-in ₹5,000', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Tournaments' })).toBeVisible();
    // The seed puts the Weeknight Turbo a week from each seeding, so it is always coming. Its card is last: the month
    // at a glance above names it too while that week falls in this month.
    await expect(page.getByText('Weeknight Turbo', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('Buy-in ₹3,000', { exact: true })).toBeVisible();
  });
});
