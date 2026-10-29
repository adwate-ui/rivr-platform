/** A dealer tablet at Table 3 with Pema Lepcha dealing, as the hand-entry and high-hand flows need one; or any table's, without a dealer. */
import { expect, type Browser, type Page } from '@playwright/test';
import { appUrl, VIEWPORT } from './apps.ts';

export const DEALER = 'Pema Lepcha';
const PIN = '2741';

/** Presses keys on the tablet one at a time: PIN digits, or the pot keypad's 1 to 9, 000, 0 and Delete. */
export async function press(tablet: Page, keys: string[]) {
  for (const key of keys) await tablet.getByRole('button', { name: key, exact: true }).click();
}

/**
 * On the console, signed in as staff who set PINs and manage devices: sets Pema's PIN, adds a
 * tablet, pairs it and fixes it to Table 3. Returns the tablet's page and name.
 */
export async function tabletAtTable3(browser: Browser, floor: Page) {
  await floor.getByRole('link', { name: 'Staff', exact: true }).click();
  await floor.getByRole('link', { name: 'Dealer PINs' }).click();
  await floor.getByLabel(`New PIN for ${DEALER}`).fill(PIN);
  await floor.getByRole('button', { name: `Save PIN for ${DEALER}` }).click();
  await expect(floor.getByText(`PIN saved for ${DEALER}.`)).toBeVisible();
  return tabletAt(browser, floor, 'Table 3');
}

/**
 * On the console, signed in as staff who manage devices at the venue it works in: adds a tablet,
 * pairs it and fixes it to `table`. Returns the tablet's page and name.
 */
export async function tabletAt(browser: Browser, floor: Page, tableName: string) {
  const name = `Tablet ${String(Date.now() % 100_000).padStart(5, '0')}`;
  await floor.getByRole('link', { name: 'Devices', exact: true }).click();
  await floor.getByRole('link', { name: 'Tablets' }).click();
  await floor.getByRole('textbox', { name: 'Tablet name' }).fill(name);
  await floor.getByRole('button', { name: 'Add and pair' }).click();
  const codeLine = floor.getByText(/^Pairing code \d{6}/);
  await expect(codeLine).toBeVisible();
  const code = (await codeLine.textContent())?.match(/\d{6}/)?.[0] ?? '';
  const tablet = await browser.newPage();
  await tablet.setViewportSize(VIEWPORT.tablet);
  await tablet.goto(appUrl('tablet'));
  await tablet.getByRole('textbox', { name: 'Pairing code' }).fill(code);
  await tablet.getByRole('button', { name: 'Pair' }).click();
  await expect(tablet.getByText('Not assigned', { exact: true })).toBeVisible();
  const table = floor.getByRole('group', { name: `Table for ${name}`, exact: true });
  await expect(floor.locator('div').filter({ has: table }).getByText('Paired', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await table.getByRole('button', { name: tableName, exact: true }).click();
  await expect(table.getByRole('button', { name: tableName, exact: true })).toHaveAttribute('aria-pressed', 'true');
  return { tablet, name };
}

/** Pema signs in on the tablet, and the table's seats open (no hand entry, #630). */
export async function dealerSignsIn(tablet: Page) {
  await tablet.reload();
  await tablet.getByRole('group', { name: 'Who is dealing?' }).getByRole('button', { name: DEALER }).click();
  await press(tablet, [...PIN]);
  await tablet.getByRole('button', { name: 'Sign in' }).click();
  await expect(tablet.getByRole('heading', { name: 'Seats', level: 1 })).toBeVisible();
}

/** Revokes the flow's tablet on the console, so the next run finds Table 3 as it was. */
export async function revoke(floor: Page, name: string) {
  await floor.getByRole('link', { name: 'Devices', exact: true }).click();
  await floor.getByRole('link', { name: 'Tablets' }).click();
  await floor.getByRole('button', { name: `Revoke ${name}`, exact: true }).click();
  await floor.getByRole('textbox', { name: 'Why it is revoked' }).fill('End of the test run');
  await floor.getByRole('button', { name: 'Revoke the tablet' }).click();
  await expect(floor.getByText(name, { exact: true })).toHaveCount(0);
}
