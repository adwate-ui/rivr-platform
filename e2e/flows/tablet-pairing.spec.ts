/**
 * Dealer tablet pairing (#41): the floor manager (Aditya Malhotra, admin) adds a tablet on the
 * console and reads out its code; the tablet signs in as itself with it; the floor manager fixes it
 * to Table 3, which the tablet then shows; and once revoked, the tablet asks to be paired again.
 */
import { expect, test } from '@playwright/test';
import { appUrl, VIEWPORT } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Dealer tablet', () => {
  test('a floor manager pairs a tablet and fixes it to a table; revoked, it asks to be paired again', async ({ browser }) => {
    const name = `Tablet ${Date.now() % 100_000}`;
    const console = await browser.newPage();
    await signInToConsole(console, '9000000103');
    await console.getByRole('link', { name: 'Tablets' }).click();
    await console.getByRole('textbox', { name: 'Tablet name' }).fill(name);
    await console.getByRole('button', { name: 'Add and pair' }).click();
    const codeLine = console.getByText(/^Pairing code \d{6}/);
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

    await console.getByRole('group', { name: `Table for ${name}` }).getByRole('button', { name: 'Table 3' }).click();
    await expect(console.getByRole('group', { name: `Table for ${name}` }).getByRole('button', { name: 'Table 3' })).toHaveAttribute('aria-pressed', 'true');
    await tablet.reload();
    await expect(tablet.getByText('Table 3', { exact: true })).toBeVisible();
    await expect(tablet.getByText('Hands are logged here once a dealer signs in.')).toBeVisible();

    await console.getByRole('button', { name: `Revoke ${name}` }).click();
    await console.getByRole('textbox', { name: 'Why it is revoked' }).fill('End of the test run');
    await console.getByRole('button', { name: 'Revoke the tablet' }).click();
    await expect(console.getByText(name, { exact: true })).toHaveCount(0);
    await tablet.reload();
    await expect(tablet.getByRole('heading', { name: 'Pair this tablet' })).toBeVisible();
  });
});
