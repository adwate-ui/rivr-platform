/**
 * Publish a promotion (#84; design prompt flow 7): the marketing manager opens Promotions, builds
 * Thursday 14:00 to 20:00, 100/200, double points, no limits, sees the player card and the TV slide
 * previewed, and publishes it; it runs live at once. 180 Tara is the flow's own: Auth sends one code
 * a minute to a number.
 */
import { expect, test } from '@playwright/test';
import { signInToConsole } from '../support/signIn.ts';

const RUNS = 'NLH 100/200 · Thursday, 14:00 to 20:00';

test.describe('Promotions', () => {
  test('Publish a promotion: Thursday 14:00 to 20:00 at 100/200, double points, no limits, live at once', async ({ page }) => {
    await signInToConsole(page, '9000000180');
    await page.getByRole('link', { name: 'Promotions' }).click();
    await expect(page.getByRole('heading', { name: 'New promotion' })).toBeVisible({ timeout: 5000 });

    await page.getByRole('group', { name: 'Days' }).getByRole('button', { name: 'Thursday' }).click();
    await page.getByRole('group', { name: 'From' }).getByRole('button', { name: '14:00' }).click();
    await page.getByRole('group', { name: 'To' }).getByRole('button', { name: '20:00' }).click();
    await page.getByRole('group', { name: 'Who' }).getByRole('button', { name: 'NLH 100/200' }).click();
    await expect(page.getByRole('group', { name: 'Reward' }).getByRole('button', { name: 'Double points' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('group', { name: 'Limits' }).getByRole('button', { name: 'None' })).toHaveAttribute('aria-pressed', 'true');

    // The player card and the TV slide, as the choices would publish them.
    await expect(page.getByRole('article', { name: 'Double points' })).toContainText(RUNS);
    await expect(page.getByRole('group', { name: 'TV slide' })).toContainText(RUNS);

    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('Double points is live.')).toBeVisible({ timeout: 10_000 });
    const running = page.getByText(RUNS, { exact: true }).first();
    await expect(running).toBeVisible();
    await expect(page.getByText('Live', { exact: true }).first()).toBeVisible();
  });
});
