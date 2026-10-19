/**
 * Website pages (#35): the club's information pages are in the navigation and draw their blocks:
 * house rules as a numbered list, questions that open to their answers, how to find the club with a
 * link to directions, and responsible play.
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
    await expect(page.getByRole('listitem').first()).toHaveText(/^Members only, 18 and over\./);

    await site.getByRole('link', { name: 'Questions' }).click();
    await page.getByText('Who can join?').click();
    await expect(page.getByText(/^Anyone 18 or over\./)).toBeVisible();

    await site.getByRole('link', { name: 'Visit' }).click();
    await expect(page.getByText('Upper floor, Glaza, M3M 65th Avenue, Sector 65, Gurugram')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get directions' })).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\//);

    await site.getByRole('link', { name: 'Responsible play' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Responsible play' })).toBeVisible();
  });
});
