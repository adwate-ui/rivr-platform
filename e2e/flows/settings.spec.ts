/**
 * Settings (#33; scope-v1 module 2, "weights sit in config so Rahul can tune them without a release").
 * This flow has its own admin (Imran Qureshi), super admin (Leela Menon) and cashier (Tara Bose).
 * - Imran opens Admin → Settings, where Floor lists its settings in groups (redesign RD-18). Change on Seat hold opens
 *   its panel on the right: he is told a value past its limits is wrong, schedules 12 minutes from tomorrow at 18:00,
 *   and withdraws it. He sees no venue configuration.
 * - Leela sets the alert number in the venue configuration, which survives a reload, and uploads the venue's
 *   logo (#397), which is there after a reload. The money areas (rake, cage, tax, chips) are hidden (#626). Her TVs tab
 *   holds the TVs' own setting under Rotation.
 * - Tara's Settings is TVs alone, with no settings on it: the address opens it, and any other tab shows a refusal.
 * The database's side (schemas, the past, who may, the audit log) is proved in supabase/tests/081.
 */
import { expect, test, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';
import { openConsole } from '../support/console.ts';

const REFUSED = 'Not in your role. Ask an admin.';

/** A one-pixel PNG, as the logo. */
const LOGO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/** Tomorrow on the club's clock, as a date field takes it. */
const tomorrow = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + 24 * 3_600_000));

/** Opens Settings and one setting's change, by its name, from its group; gives the panel it opens on the right. */
async function openSetting(page: Page, name: string) {
  await openConsole(page, '/settings');
  await page.getByRole('searchbox', { name: 'Find a setting' }).fill(name);
  await page.getByRole('button', { name: `Change ${name}`, exact: true }).click();
  const panel = page.getByRole('dialog', { name });
  await expect(panel).toBeVisible();
  return panel;
}

/** Opens one of Settings' areas from its tabs. */
async function openArea(page: Page, area: string) {
  await page.getByRole('navigation', { name: 'Settings', exact: true }).getByRole('link', { name: area }).click();
}

test.describe('Settings', () => {
  test('Settings: an admin schedules a setting from tomorrow and withdraws it; a super admin edits the venue, with no money areas; a cashier sees only TVs', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'changes settings and chips, so the local stack only');
    test.setTimeout(120_000);
    const admin = await browser.newPage();
    await signInToConsole(admin, '9000000153');
    await openConsole(admin, '/settings');
    await expect(admin.getByRole('heading', { name: 'Seating', level: 2 })).toBeVisible();
    await expect(admin.getByRole('heading', { name: 'Time at the table', level: 2 })).toBeVisible();
    await expect(admin.getByRole('table', { name: 'Seating' }).getByText('How long a called seat is held')).toBeVisible();
    const panel = await openSetting(admin, 'Seat hold');
    // A run stopped part-way may have left its change to come.
    const leftOver = panel.getByRole('button', { name: /^Withdraw the change from/ });
    if (await leftOver.count() > 0) await leftOver.first().click();
    await expect(admin.getByRole('heading', { name: 'Venue configuration' })).toHaveCount(0);

    await panel.getByRole('textbox', { name: 'Minutes' }).fill('500');
    await panel.getByRole('textbox', { name: 'Reason' }).fill('Busier nights');
    await panel.getByRole('button', { name: 'Save change' }).click();
    await expect(panel.getByRole('textbox', { name: 'Minutes' })).toHaveAttribute('aria-invalid', 'true');
    await expect(panel.getByText('Between 1 and 120 minutes.')).toBeVisible();
    await panel.getByRole('textbox', { name: 'Minutes' }).fill('12');
    await panel.getByRole('radiogroup', { name: 'Takes effect' }).getByRole('radio', { name: 'From a day and time' }).click();
    await panel.getByLabel('Day').fill(tomorrow());
    await panel.getByRole('textbox', { name: 'Time' }).fill('18:00');
    await panel.getByRole('button', { name: 'Save change' }).click();
    await expect(panel.getByText('Change saved.')).toBeVisible();
    await expect(panel.getByText(/^From .*, 18:00: 12 minutes$/)).toBeVisible();
    // Its row, behind the panel, says the change to come too.
    await expect(admin.getByText(/^From .*, 18:00: 12 minutes$/)).toHaveCount(2);
    await panel.getByRole('button', { name: /^Withdraw the change from/ }).click();
    await expect(panel.getByText('Change withdrawn.')).toBeVisible();
    await expect(admin.getByText(/^From .*: 12 minutes$/)).toHaveCount(0);

    const owner = await browser.newPage();
    await signInToConsole(owner, '9000000154');
    await openConsole(owner, '/settings');
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

    // No console shows money or rake (#626): Settings has no rake, cage, tax or chips area.
    const areas = owner.getByRole('navigation', { name: 'Settings', exact: true });
    for (const hidden of ['Rake and jackpots', 'Cage and credit', 'Tax', 'Chips']) await expect(areas.getByRole('link', { name: hidden })).toHaveCount(0);
    await openArea(owner, 'TVs');
    await expect(owner.getByRole('table', { name: 'Rotation' }).getByText('TV hours leaderboard')).toBeVisible();

    const cashier = await browser.newPage();
    await signInToConsole(cashier, '9000000155');
    await expect(cashier.getByRole('link', { name: 'Live floor', exact: true })).toBeVisible();
    await cashier.goto(`${appUrl('console')}/settings`);
    await expect(cashier.getByRole('heading', { name: 'TVs', level: 2 })).toBeVisible();
    await expect(cashier.getByRole('heading', { name: 'Rotation' })).toHaveCount(0);
    await cashier.goto(`${appUrl('console')}/settings?tab=members`);
    await expect(cashier.getByText(REFUSED)).toBeVisible();
  });
});
