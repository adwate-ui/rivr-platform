/**
 * Website pages (#35): the club's information pages are in the navigation and draw their blocks:
 * house rules as a numbered list, questions that open to their answers, how to find the club with a
 * link to directions, and responsible play; the front page shows the games and the calendar, live.
 */
import { expect, test } from '@playwright/test';
import { appUrl, VIEWPORT } from '../support/apps.ts';

test.describe('Website', () => {
  test('the information pages: house rules, questions, visit and responsible play', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.web);
    await page.goto(`${appUrl('web')}/?ref=FRIEND1`);
    const site = page.getByRole('navigation', { name: 'Site' });

    await site.getByRole('link', { name: 'House rules' }).click();
    await expect(page).toHaveURL(/\/house-rules\?ref=FRIEND1$/);
    await expect(page.getByRole('heading', { level: 1, name: 'House rules' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('listitem').first()).toHaveText(/^Members only, 18 and over\./);

    await site.getByRole('link', { name: 'Questions' }).click();
    await page.getByText('Who can join?').click();
    await expect(page.getByText(/^Anyone 18 or over\./)).toBeVisible();

    await site.getByRole('link', { name: 'Visit' }).click();
    await expect(page.getByText('Upper floor, Glaza, M3M 65th Avenue, Sector 65, Gurugram')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get directions' })).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\//);

    await site.getByRole('link', { name: 'Responsible play' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Responsible play' })).toBeVisible();
  });

  test('the front page shows the games and stakes and the tournament calendar, live from the club', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.web);
    await page.goto(appUrl('web'));
    await expect(page.getByRole('heading', { level: 2, name: 'Games and stakes' })).toBeVisible();
    await expect(page.getByText('NLH 50/100', { exact: true })).toBeVisible();
    await expect(page.getByText('Buy-in ₹5,000', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Tournaments' })).toBeVisible();
    // The seeded RIVR Sunday leaves the calendar once it has started; then the calendar says it is empty.
    await expect(page.getByText('RIVR Sunday').or(page.getByText('No tournaments on the calendar yet.'))).toBeVisible();
  });
});
