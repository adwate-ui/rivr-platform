/**
 * The dealer tablet (#41), end to end, signed in once on the console as the deputy general manager
 * (Kunal Desai, this flow's own sign-in: Auth sends one code a minute to a number):
 * - he adds a tablet and reads out its code; the tablet pairs with it, and the console shows it paired;
 * - he fixes it to Table 3, which the tablet shows, asking a dealer to sign in;
 * - he sets Pema Lepcha's PIN; on the tablet she picks her name, a wrong PIN is refused with the tries
 *   left, the right one starts her down, and End of down asks for the next dealer;
 * - once revoked, the tablet asks to be paired again.
 */
import { expect, test, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget, VIEWPORT } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const DEALER = 'Pema Lepcha';

/** Presses a PIN on the tablet's PIN pad, a key at a time. */
async function pressPin(tablet: Page, pin: string) {
  for (const digit of pin) await tablet.getByRole('button', { name: digit, exact: true }).click();
}

test.describe('Dealer tablet', () => {
  test('Dealer sign-in: pair a tablet, fix it to Table 3, set a PIN; the dealer signs in and ends her down; revoked, it asks to pair again', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'makes a device login, takes a table and sets a PIN, so the local stack only');
    test.setTimeout(90_000);
    // Five digits always, so no earlier run's tablet name is a prefix of this one.
    const name = `Tablet ${String(Date.now() % 100_000).padStart(5, '0')}`;
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000112');
    await floor.getByRole('link', { name: 'Tablets' }).click();
    await floor.getByRole('textbox', { name: 'Tablet name' }).fill(name);
    await floor.getByRole('button', { name: 'Add and pair' }).click();
    const codeLine = floor.getByText(/^Pairing code \d{6}/);
    await expect(codeLine).toBeVisible();
    const code = (await codeLine.textContent())?.match(/\d{6}/)?.[0] ?? '';

    const tablet = await browser.newPage();
    await tablet.setViewportSize(VIEWPORT.tablet);
    await tablet.goto(appUrl('tablet'));
    await expect(tablet.getByRole('heading', { name: 'Tablet pairing' })).toBeVisible();
    await tablet.getByRole('textbox', { name: 'Pairing code' }).fill('000000');
    await tablet.getByRole('button', { name: 'Pair' }).click();
    await expect(tablet.getByText('That code is not right or has run out. Ask for a new one.')).toBeVisible();
    await tablet.getByRole('textbox', { name: 'Pairing code' }).fill(code);
    await tablet.getByRole('button', { name: 'Pair' }).click();
    await expect(tablet.getByRole('heading', { name: 'Hand entry' })).toBeVisible();
    await expect(tablet.getByText('Not assigned', { exact: true })).toBeVisible();

    // The console's list asks again every ten seconds, so the tablet shows as paired on its own.
    const table = floor.getByRole('group', { name: `Table for ${name}`, exact: true });
    await expect(floor.locator('div').filter({ has: table }).getByText('Paired', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await table.getByRole('button', { name: 'Table 3', exact: true }).click();
    await expect(table.getByRole('button', { name: 'Table 3', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await tablet.reload();
    await expect(tablet.getByText('Table 3', { exact: true })).toBeVisible();
    await expect(tablet.getByRole('heading', { name: 'Dealer sign-in' })).toBeVisible();

    // The PIN is set while the tablet waits on sign-in: its list asks again every 15 seconds, no reload.
    await floor.getByRole('link', { name: 'Dealer PINs' }).click();
    await floor.getByLabel(`New PIN for ${DEALER}`).fill('2741');
    await floor.getByRole('button', { name: `Save PIN for ${DEALER}` }).click();
    await expect(floor.getByText(`PIN saved for ${DEALER}.`)).toBeVisible();
    const dealerChip = tablet.getByRole('group', { name: 'Who is dealing?' }).getByRole('button', { name: DEALER });
    await expect(dealerChip).toBeVisible({ timeout: 20_000 });
    await dealerChip.click();
    await pressPin(tablet, '2740');
    await tablet.getByRole('button', { name: 'Sign in' }).click();
    await expect(tablet.getByText('That PIN is not right. 4 tries left before it locks.')).toBeVisible();
    await pressPin(tablet, '2741');
    await tablet.getByRole('button', { name: 'Sign in' }).click();
    await expect(tablet.getByText(new RegExp(`^${DEALER} · down since \\d{2}:\\d{2}$`))).toBeVisible();
    await expect(tablet.getByRole('button', { name: 'Log hand' })).toBeVisible();
    await tablet.getByRole('button', { name: 'End of down' }).click();
    await expect(tablet.getByRole('heading', { name: 'Dealer sign-in' })).toBeVisible();

    await floor.getByRole('link', { name: 'Tablets' }).click();
    await floor.getByRole('button', { name: `Revoke ${name}`, exact: true }).click();
    await floor.getByRole('textbox', { name: 'Why it is revoked' }).fill('End of the test run');
    await floor.getByRole('button', { name: 'Revoke the tablet' }).click();
    await expect(floor.getByText(name, { exact: true })).toHaveCount(0);
    await tablet.reload();
    await expect(tablet.getByRole('heading', { name: 'Tablet pairing' })).toBeVisible();
  });
});
