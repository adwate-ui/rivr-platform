/**
 * Settings (#33; scope-v1 module 2, "weights sit in config so Rahul can tune them without a release").
 * This flow has its own admin (Imran Qureshi), super admin (Leela Menon) and cashier (Tara Bose).
 * - Imran opens Admin → Settings, opens Seat hold under Floor, is told a value past its limits is wrong,
 *   schedules 12 minutes from tomorrow, and withdraws it. He sees no venue configuration.
 * - Leela sets the alert number in the venue configuration, which survives a reload, uploads the venue's
 *   logo (#397), which is there after a reload, and adds a chip, then takes it out of use (in `finally`, so
 *   the Treasury flow never has to count it).
 * - Tara has no Settings in her rail, and the address shows a refusal.
 * The database's side (schemas, the past, who may, the audit log) is proved in supabase/tests/081.
 */
import { expect, test, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const REFUSED = 'Your role does not include this screen. Ask an admin if you need it.';

/** A one-pixel PNG, as the logo. */
const LOGO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/** Tomorrow on the club's clock, as a date field takes it. */
const tomorrow = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + 24 * 3_600_000));

/** Opens Settings and one setting, by its name, from its area's list. */
async function openSetting(page: Page, name: string) {
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Find a setting' }).fill(name);
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible();
}

/** Opens one of Settings' areas from its tabs. */
async function openArea(page: Page, area: string) {
  await page.getByRole('navigation', { name: 'Areas' }).getByRole('link', { name: area }).click();
}

test.describe('Settings', () => {
  test('Settings: an admin schedules a setting from tomorrow and withdraws it; a super admin edits the venue and its chips; a cashier is kept out', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'changes settings and chips, so the local stack only');
    test.setTimeout(120_000);
    const admin = await browser.newPage();
    await signInToConsole(admin, '9000000153');
    await openSetting(admin, 'Seat hold');
    // A run stopped part-way may have left its change to come.
    const leftOver = admin.getByRole('button', { name: /^Withdraw the change from/ });
    if (await leftOver.count() > 0) await leftOver.first().click();
    await expect(admin.getByRole('heading', { name: 'Venue configuration' })).toHaveCount(0);

    await admin.getByRole('textbox', { name: 'Minutes' }).fill('500');
    await admin.getByRole('textbox', { name: 'Reason' }).fill('Busier nights');
    await admin.getByRole('button', { name: 'Save change' }).click();
    await expect(admin.getByRole('textbox', { name: 'Minutes' })).toHaveAttribute('aria-invalid', 'true');
    await expect(admin.getByText('Between 1 and 120 minutes.')).toBeVisible();
    await admin.getByRole('textbox', { name: 'Minutes' }).fill('12');
    await admin.getByRole('group', { name: 'Takes effect' }).getByRole('button', { name: 'From a later day' }).click();
    await admin.getByLabel('Day').fill(tomorrow());
    await admin.getByRole('button', { name: 'Save change' }).click();
    await expect(admin.getByText('Change saved.')).toBeVisible();
    await expect(admin.getByText(/^From .*: 12 minutes$/)).toBeVisible();
    await admin.getByRole('button', { name: /^Withdraw the change from/ }).click();
    await expect(admin.getByText('Change withdrawn.')).toBeVisible();
    await expect(admin.getByText(/^From .*: 12 minutes$/)).toHaveCount(0);

    const owner = await browser.newPage();
    await signInToConsole(owner, '9000000154');
    await owner.getByRole('link', { name: 'Settings', exact: true }).click();
    await openArea(owner, 'Club details');
    await owner.getByRole('textbox', { name: 'Alert WhatsApp number' }).fill('98765 43210');
    await owner.getByRole('button', { name: 'Save configuration' }).click();
    await expect(owner.getByText('Configuration saved.')).toBeVisible();
    await owner.reload();
    await expect(owner.getByRole('textbox', { name: 'Alert WhatsApp number' })).toHaveValue('+919876543210');

    // The venue's logo: a PNG uploaded on Settings is there after a reload.
    await owner.locator('input[type="file"]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: LOGO });
    await expect(owner.getByText('Logo saved.')).toBeVisible();
    await owner.reload();
    await expect(owner.getByRole('img', { name: 'The venue’s logo' })).toHaveAttribute('src', /\/brand\/.*\/logo-.*\.png$/);

    await openArea(owner, 'Chips');
    // A value no earlier run used: ₹5,00,000 to ₹9,49,950 in ₹50 steps.
    const rupees = 50 * (10_000 + (Date.now() % 9_000));
    const chip = `Test chip ${rupees}`;
    await owner.getByRole('textbox', { name: 'Value in rupees' }).fill(String(rupees));
    await owner.getByRole('textbox', { name: 'Name', exact: true }).fill(chip);
    await owner.getByRole('button', { name: 'Add chip' }).click();
    try {
      await expect(owner.getByText('Chip added.')).toBeVisible();
      await expect(owner.getByRole('switch', { name: `In use: ${chip}` })).toHaveAttribute('aria-checked', 'true');
    } finally {
      // Out of use whatever happened above, so the Treasury flow never has to count it; never switched on.
      const inUse = owner.getByRole('switch', { name: `In use: ${chip}` });
      if (await inUse.getAttribute('aria-checked') === 'true') await inUse.click();
      await expect(inUse).toHaveAttribute('aria-checked', 'false');
    }

    const cashier = await browser.newPage();
    await signInToConsole(cashier, '9000000155');
    await expect(cashier.getByRole('link', { name: 'Cage', exact: true })).toBeVisible();
    await expect(cashier.getByRole('link', { name: 'Settings', exact: true })).toHaveCount(0);
    await cashier.goto(`${appUrl('console')}/settings`);
    await expect(cashier.getByText(REFUSED)).toBeVisible();
  });
});
