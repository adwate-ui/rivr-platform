/**
 * SOP library (#51; scope-v1 module 11): the club's library holds the training set.
 * - A dealer reads the dealer certification and acknowledges it.
 * - The floor manager publishes a new version of table-side food and drink from today, which asks the
 *   dealers again, and sees the dealer has not yet acknowledged it; once she has, he sees when.
 * Each person is the flow's own: Auth sends one code a minute to a number.
 */
import { expect, test, type Page } from '@playwright/test';
import { signInToConsole } from '../support/signIn.ts';

const FNB = 'Table-side food and drink';

/** Signs in and opens SOPs. */
async function openSops(page: Page, number: string) {
  await signInToConsole(page, number);
  await expect(page.getByRole('heading', { name: 'Live floor' })).toBeVisible();
  await page.getByRole('link', { name: 'SOPs' }).click();
  await expect(page.getByRole('heading', { name: 'SOPs' })).toBeVisible({ timeout: 5000 });
}

/** Opens one SOP and acknowledges its version in force, unless that is done already. */
async function acknowledge(page: Page, title: string) {
  await page.getByRole('button', { name: `Read ${title}` }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  // An earlier run on the same database may have acknowledged this version already: wait for either.
  const button = page.getByRole('button', { name: 'Acknowledge' });
  const acknowledged = page.getByText(/^You acknowledged this version on \d{1,2} [A-Z][a-z]{2,3} \d{4}\.$/);
  await expect(button.or(acknowledged)).toBeVisible();
  if (await button.isVisible()) await button.click();
  // The acknowledgement reloads the library: slow on a busy machine.
  await expect(acknowledged).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Back to SOPs' }).click();
}

test.describe('SOP library', () => {
  test('a dealer acknowledges the dealer certification; the floor manager publishes a version and sees who has acknowledged it', async ({ browser }) => {
    test.setTimeout(90_000);
    const dealer = await browser.newPage();
    await openSops(dealer, '9000000173');
    for (const title of ['Anti-money laundering', 'Cage', 'Dealer certification', FNB, 'Women\'s safety']) {
      await expect(dealer.getByText(title, { exact: true })).toBeVisible();
    }
    await dealer.getByRole('button', { name: 'Read Dealer certification' }).click();
    await expect(dealer.getByText('To be acknowledged by Dealers.')).toBeVisible();
    await expect(dealer.getByText(/^1\. Sign in on the tablet at your table with your PIN/)).toBeVisible();
    await dealer.getByRole('button', { name: 'Back to SOPs' }).click();
    await acknowledge(dealer, 'Dealer certification');

    const floor = await browser.newPage();
    await openSops(floor, '9000000174');
    await floor.getByRole('button', { name: `Read ${FNB}` }).click();
    await floor.getByRole('button', { name: 'New version' }).click();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    await floor.getByLabel('Takes effect on').fill(today);
    const body = floor.getByRole('textbox', { name: 'Text' });
    await body.fill(`${await body.inputValue()}\n6. Run ${Date.now()}: ask before clearing a player's chips to make room.`);
    await floor.getByRole('button', { name: 'Publish version' }).click();
    const bhavna = floor.getByRole('table', { name: 'Acknowledgements' }).getByRole('row').filter({ hasText: 'Bhavna Rawat' });
    await expect(bhavna.getByText('Not yet')).toBeVisible();

    await dealer.reload();
    await expect(dealer.getByRole('heading', { name: 'SOPs' })).toBeVisible();
    await acknowledge(dealer, FNB);
    await floor.reload();
    await floor.getByRole('button', { name: `Read ${FNB}` }).click();
    await expect(bhavna.getByText(/^\d{1,2} [A-Z][a-z]{2,3} \d{4}, \d{2}:\d{2}$/)).toBeVisible();
  });
});
