/**
 * The owner's own journey on staging (design 3d): real WhatsApp, seen on the owner's phone. The super admin opens a
 * table, adds the owner to its list by number, and seats them from the list, which sends "Your seat is ready" to the
 * owner's phone (the only number on WHATSAPP_ALLOWLIST); then lets them go and checks them out. The owner confirms the
 * message by hand. Their number and name come from the environment (OWNER_PHONE, OWNER_NAME), never a file, and this
 * walk keeps no trace or screenshot (they would hold the number). Run only by hand through `pnpm staging:owner`.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { appUrl } from '../../../e2e/support/apps.ts';
import { openFromRail } from '../../../e2e/support/console.ts';
import { letGoEarly } from '../../../e2e/support/floor.ts';
import { signInToConsole } from '../../../e2e/support/signIn.ts';

const SUPER = process.env['SIM_SUPER_NUMBER'] ?? '9000000101';
const PHONE = process.env['OWNER_PHONE'] ?? '';
const NAME = process.env['OWNER_NAME'] ?? '';

test.use({ trace: 'off', screenshot: 'off' });

/** A table's own card on the Waitlist screen (waitlist.spec.ts:51-54). */
const gameList = (page: Page, table: string): Locator =>
  page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: table, exact: true }) }).last();

/** The first open table's name, opening Table 1 when none is (journeys.walk.ts openATable). */
async function openTable(floor: Page): Promise<string> {
  const tiles = floor.getByRole('group').filter({ has: floor.getByRole('button', { name: /^Settings for / }) });
  await expect(tiles.first()).toBeVisible({ timeout: 20_000 });
  const open = tiles.filter({ hasNot: floor.getByRole('button', { name: 'Open table' }) });
  const tile = (await open.count()) > 0 ? open.first() : tiles.first();
  const table = ((await tile.getByRole('button', { name: /^Settings for / }).first().getAttribute('aria-label')) ?? '').replace(/^Settings for /, '');
  if ((await open.count()) === 0) await tile.getByRole('button', { name: 'Open table' }).first().click();
  return table;
}

/** A name as a pattern: table names hold brackets ("Table 1 (NLHE)"). */
const literal = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
const STEP = process.env['OWNER_STEP'] ?? 'all';

test.describe.serial('the owner on staging', () => {
  test('is added to a list and seated from it, which tells them by WhatsApp', async ({ page }) => {
    test.skip(STEP === 'cleanup', 'only the clean-up');
    test.setTimeout(300_000);
    if (!/^\d{10}$/.test(PHONE) || NAME === '') throw new Error('OWNER_PHONE (ten digits) and OWNER_NAME are needed');
    await signInToConsole(page, SUPER);
    const table = await openTable(page);
    await page.goto(`${appUrl('console')}/waitlist`);
    const list = gameList(page, table);
    await list.getByRole('textbox', { name: 'Add: mobile or member no.' }).fill(PHONE);
    await list.getByRole('button', { name: 'Add', exact: true }).click();
    await list.getByRole('button', { name: `Seat ${NAME}` }).click();
    const sheet = page.getByRole('dialog', { name: `Seat ${NAME}` });
    await sheet.getByRole('radiogroup', { name: 'Seat', exact: true }).getByRole('radio').first().click();
    await sheet.getByRole('radiogroup', { name: 'Call time' }).getByRole('radio', { name: '3 h', exact: true }).click();
    await sheet.getByRole('button', { name: 'Seat', exact: true }).click();
    await expect(page.getByText(new RegExp(`^${literal(NAME)} seated at ${literal(table)}, seat \\d+$`))).toBeVisible({ timeout: 20_000 });
    // The WhatsApp consumer runs each minute; give it two before the member leaves.
    await page.waitForTimeout(120_000);
  });

  test('is let go early and checked out at the door', async ({ page }) => {
    test.setTimeout(180_000);
    await signInToConsole(page, SUPER);
    await openFromRail(page, 'Live floor');
    await letGoEarly(page, NAME, 'Floor decision');
    await openFromRail(page, 'Door');
    await page.getByRole('textbox', { name: 'Card, mobile, number or name' }).fill(PHONE);
    await page.getByRole('button', { name: 'Check out' }).first().click();
    await expect(page.getByText('Checked out.')).toBeVisible({ timeout: 20_000 });
  });
});
