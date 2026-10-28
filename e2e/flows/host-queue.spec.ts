// Host queue (#165): a host records why a lapsed regular stopped coming and the offer made, then closes the call.
import { expect, test } from '@playwright/test';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

test('Host queue: a host records why a lapsed regular stopped coming and an offer, then closes the call', async ({ browser, page }) => {
  // The queue lists only players a host may call with an offer, so Ritika first turns on promotions in her profile.
  // The seed leaves her consent out because other tests count the members who opted in.
  const ritika = await (await browser.newContext()).newPage();
  await signInToPlayer(ritika, '9000000642');
  await ritika.getByRole('link', { name: 'Profile' }).click();
  const promotions = ritika.getByRole('switch', { name: 'Promotions and offers' });
  await promotions.click();
  await expect(promotions).toBeChecked();

  await signInToConsole(page, '9000000643');
  await page.getByRole('link', { name: 'Host queue' }).click();
  await expect(page.getByRole('heading', { name: 'Ritika Bhalla' })).toBeVisible();
  await page.getByRole('group', { name: 'Why Ritika Bhalla stopped coming' }).getByRole('button', { name: 'Busy' }).click();
  await page.getByRole('group', { name: 'Offer to Ritika Bhalla' }).getByRole('button', { name: 'Points' }).click();
  await page.getByRole('textbox', { name: 'Points for Ritika Bhalla' }).fill('500');
  await page.getByRole('button', { name: 'Save the call to Ritika Bhalla' }).click();
  await expect(page.getByText('Offered: 500 points')).toBeVisible();
  await page.getByRole('button', { name: 'Close Ritika Bhalla' }).click();
  await expect(page.getByText('No lapsed regulars to call.')).toBeVisible();
});
