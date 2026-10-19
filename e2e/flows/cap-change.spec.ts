/**
 * Rake changes from the console (#37, scope-v1 module 3 acceptance), signed in as a floor manager
 * (Farhan Siddiqui, this flow's own number: Auth sends one code a minute to a number). The NLH
 * 100/200 tables rake 5% to a ₹6,000 cap. A change from yesterday is refused; he schedules a ₹7,000
 * cap from tomorrow at 10:00 IST with a reason, sees it under the table type, and withdraws it, so
 * the other flows still find the ₹6,000 cap. That hands before a change keep the old cap is proved
 * in supabase/tests/038_rake_change.test.sql.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const DAY = 24 * 3_600_000;

/** The date in India `days` from now: as the date field takes it, and as the console shows it. */
function dayInIndia(days: number) {
  const at = new Date(Date.now() + days * DAY);
  return {
    field: at.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    shown: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }).format(at),
  };
}

test.describe('Rake', () => {
  test('Cap change: a change from yesterday is refused; a ₹7,000 cap from tomorrow is scheduled, shown and withdrawn', async ({ page }) => {
    test.skip(isRemoteTarget(), 'changes a setting, so the local stack only');
    const tomorrow = dayInIndia(1);
    await signInToConsole(page, '9000000115');
    await page.getByRole('link', { name: 'Rake' }).click();
    await expect(page.getByText('5% of the pot, cap ₹6,000', { exact: true })).toBeVisible();
    // A run that failed before withdrawing left its change; this run's would clash with it.
    const withdraw = page.getByRole('button', { name: `Withdraw the change from ${tomorrow.shown}, 10:00` });
    if ((await withdraw.count()) > 0) await withdraw.click();
    await expect(withdraw).toHaveCount(0);

    await page.getByRole('group', { name: 'Table type' }).getByRole('button', { name: 'NLH 100/200' }).click();
    await page.getByRole('textbox', { name: 'Rate (%)' }).fill('5');
    await page.getByRole('textbox', { name: 'Cap (₹)' }).fill('7000');
    await page.getByLabel('From', { exact: true }).fill(dayInIndia(-1).field);
    await page.getByRole('textbox', { name: 'At (IST)' }).fill('10:00');
    await page.getByRole('textbox', { name: 'Why it changes' }).fill('Weekend cap');
    await page.getByRole('button', { name: 'Schedule the change' }).click();
    await expect(page.getByText(/^That change was refused\. A change takes effect from now or later/)).toBeVisible();

    await page.getByLabel('From', { exact: true }).fill(tomorrow.field);
    await page.getByRole('button', { name: 'Schedule the change' }).click();
    await expect(page.getByText('Change scheduled.')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Table type' }).getByRole('button', { name: 'NLH 100/200' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText(`From ${tomorrow.shown}, 10:00: 5% of the pot, cap ₹7,000`, { exact: true })).toBeVisible();
    await expect(page.getByText('5% of the pot, cap ₹6,000', { exact: true })).toBeVisible();

    await withdraw.click();
    await expect(page.getByText(`From ${tomorrow.shown}, 10:00: 5% of the pot, cap ₹7,000`, { exact: true })).toHaveCount(0);
  });
});
