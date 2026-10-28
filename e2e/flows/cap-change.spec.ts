/**
 * Rake changes from the console (#37, scope-v1 module 3 acceptance), signed in as a floor manager
 * (Farhan Siddiqui, this flow's own number: Auth sends one code a minute to a number). The NLH
 * 100/200 tables rake 5% to a ₹6,000 cap. A change from yesterday is refused; he schedules a ₹7,000
 * cap from 1 Jan 2099 at 10:00 IST with a reason, sees it under the table type, and withdraws it, so
 * the other flows still find the ₹6,000 cap. Every change to come is withdrawn before and after, so a
 * run that failed halfway leaves nothing behind. That hands before a change keep the old cap is
 * proved in packages/testing/golden/settings.json and supabase/tests/038_rake_change.test.sql. Rake is in
 * Settings' Rake area (#604); he opens it by its old address, which leads there.
 */
import { expect, test, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const SCHEDULED = 'From 1 Jan 2099, 10:00: 5% of the pot, cap ₹7,000';

/** Yesterday in India, as the date field takes it: `2026-10-18`. */
function yesterdayInIndia(): string {
  return new Date(Date.now() - 24 * 3_600_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** Withdraws every change to come in the Rake area. */
async function withdrawAll(page: Page) {
  const withdraw = page.getByRole('button', { name: /^Withdraw the change from / });
  while ((await withdraw.count()) > 0) {
    const before = await withdraw.count();
    await withdraw.first().click();
    await expect(withdraw).toHaveCount(before - 1);
  }
}

test.describe('Rake', () => {
  test('Cap change: a change from yesterday is refused; a ₹7,000 cap from 1 Jan 2099 is scheduled, shown and withdrawn', async ({ page }) => {
    test.skip(isRemoteTarget(), 'changes a setting, so the local stack only');
    await signInToConsole(page, '9000000115');
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.goto(`${appUrl('console')}/rake`);
    await expect(page.getByRole('navigation', { name: 'Areas' }).getByRole('link', { name: 'Rake and jackpots' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText('5% of the pot, cap ₹6,000', { exact: true })).toBeVisible();
    await withdrawAll(page);
    try {
      await page.getByRole('group', { name: 'Table type' }).getByRole('button', { name: 'NLH 100/200' }).click();
      await page.getByRole('textbox', { name: 'Rate (%)' }).fill('5');
      await page.getByRole('textbox', { name: 'Cap (₹)' }).fill('7000');
      await page.getByLabel('From', { exact: true }).fill(yesterdayInIndia());
      await page.getByRole('textbox', { name: 'At (IST)' }).fill('10:00');
      await page.getByRole('textbox', { name: 'Why it changes' }).fill('Weekend cap');
      await page.getByRole('button', { name: 'Schedule the change' }).click();
      await expect(page.getByText(/^That is too close to now: a hand may already be played under it\./)).toBeVisible();

      await page.getByLabel('From', { exact: true }).fill('2099-01-01');
      await page.getByRole('button', { name: 'Schedule the change' }).click();
      await expect(page.getByText('Change scheduled.')).toBeVisible();
      await expect(page.getByRole('group', { name: 'Table type' }).getByRole('button', { name: 'NLH 100/200' })).toHaveAttribute('aria-pressed', 'false');
      await expect(page.getByText(SCHEDULED, { exact: true })).toBeVisible();
      await expect(page.getByText('5% of the pot, cap ₹6,000', { exact: true })).toBeVisible();

      await page.getByRole('button', { name: 'Withdraw the change from 1 Jan 2099, 10:00' }).click();
      await expect(page.getByText(SCHEDULED, { exact: true })).toHaveCount(0);
    } finally {
      await withdrawAll(page);
    }
  });
});
