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
  test('the information pages: house rules, questions, visit, responsible play and privacy', async ({ page }) => {
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

    await site.getByRole('link', { name: 'Visit & Contact' }).click();
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

  test('the club’s pages: about, membership, promotions, and a journal article, each keeping the visitor’s codes', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.web);
    await page.goto(`${appUrl('web')}/?ref=FRIEND1`);
    await page.getByRole('button', { name: 'Essential only' }).click();
    const site = page.getByRole('navigation', { name: 'Site' });

    await site.getByRole('link', { name: 'The Club' }).click();
    await expect(page).toHaveURL(/\/about\?ref=FRIEND1$/);
    await expect(page.getByRole('heading', { level: 1, name: 'About RIVR' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Poker is a game of skill.' })).toBeVisible();
    await expect(page.getByText('K.R. Lakshmanan v. State of Tamil Nadu')).toBeVisible();

    await site.getByRole('link', { name: 'Membership' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'RIVR membership' })).toBeVisible();
    // The points by table are the rules in force (61_points.sql), not words in the page.
    await expect(page.getByRole('row', { name: /Private Room/ }).getByRole('cell', { name: '20' })).toBeVisible();
    await expect(page.getByText(/RIVR Rewards: 5% of your rake comes back as points\./)).toBeVisible();

    // The seed publishes Buy-in bonus Tuesday, high hands and the referral (57_promotions.sql).
    await site.getByRole('link', { name: 'Prizes & Calendar' }).click();
    await expect(page.getByRole('heading', { level: 3, name: 'Buy-in bonus Tuesday' })).toBeVisible();

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
    // The seed puts the Weeknight Turbo a week from each seeding, so it is always coming.
    await expect(page.getByText('Weeknight Turbo', { exact: true })).toBeVisible();
    await expect(page.getByText('Buy-in ₹3,000', { exact: true })).toBeVisible();
  });
});
