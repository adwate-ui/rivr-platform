/**
 * Dealer tablet pairing (#41): the deputy general manager (Kunal Desai, this flow's own sign-in: Auth
 * sends one code a minute to a number) adds a tablet on the console and reads out its code; the
 * tablet signs in as itself with it, and the console shows it paired; he fixes it to Table 3, which
 * the tablet then shows; and once revoked, the tablet asks to be paired again.
 */
import { expect, test } from '@playwright/test';
import { appUrl, isRemoteTarget, VIEWPORT } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Dealer tablet', () => {
  test('a floor manager pairs a tablet and fixes it to a table; revoked, it asks to be paired again', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'makes a device login and takes a table, so the local stack only');
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
    await expect(tablet.getByRole('heading', { name: 'Pair this tablet' })).toBeVisible();
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
    await expect(tablet.getByText('Hands are logged here once a dealer signs in.')).toBeVisible();

    await floor.getByRole('button', { name: `Revoke ${name}`, exact: true }).click();
    await floor.getByRole('textbox', { name: 'Why it is revoked' }).fill('End of the test run');
    await floor.getByRole('button', { name: 'Revoke the tablet' }).click();
    await expect(floor.getByText(name, { exact: true })).toHaveCount(0);
    await tablet.reload();
    await expect(tablet.getByRole('heading', { name: 'Pair this tablet' })).toBeVisible();
  });
});
