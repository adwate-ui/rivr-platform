// Host queue (#165): a host records why a lapsed regular stopped coming and the offer made, then closes the call.
import { expect, test } from '@playwright/test';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

test('Host queue: a host records why a lapsed regular stopped coming and an offer, then closes the call', async ({ browser, page }) => {
  // The queue lists only players a host may call with an offer, so Ritika first turns on promotions in her profile.
  // The seed leaves her consent out because other tests count the members who opted in.
  const ritika = await (await browser.newContext()).newPage();
  await signInToPlayer(ritika, '9000000642');
  await ritika.getByRole('link', { name: 'Profile' }).click();
  const promotions = ritika.getByRole('switch', { name: 'Offers', exact: true });
  await promotions.click();
  await expect(promotions).toBeChecked();

  // Sameer is a host, not an admin: the host role has the queue (F2-04).
  await signInToConsole(page, '9000000643');
  await page.getByRole('link', { name: 'Host queue' }).click();
  // The longest gone opens beside the queue (console v3).
  await expect(page.getByRole('heading', { name: 'Ritika Bhalla', level: 2 })).toBeVisible();
  // A call is saved only with the reason she stopped coming.
  await page.getByRole('button', { name: 'Save the call to Ritika Bhalla' }).click();
  await expect(page.getByText('Choose why they stopped coming.')).toBeVisible();
  await page.getByRole('radiogroup', { name: 'Why they stopped coming' }).getByRole('radio', { name: 'Busy' }).click();
  await page.getByRole('radiogroup', { name: 'Offer', exact: true }).getByRole('radio', { name: 'Points' }).click();
  await page.getByRole('textbox', { name: 'Points', exact: true }).fill('500');
  await page.getByRole('button', { name: 'Save the call to Ritika Bhalla' }).click();
  await expect(page.getByText('Offered: 500 points')).toBeVisible();
  await expect(page.getByRole('status').getByText('Call to Ritika Bhalla saved.')).toBeVisible();
  // Taking her off the queue is for good, so it is asked twice (F2-19).
  await page.getByRole('button', { name: 'Take off the queue: Ritika Bhalla' }).click();
  await page.getByRole('button', { name: 'Yes, take Ritika Bhalla off the queue' }).click();
  await expect(page.getByText('No lapsed regulars to call.')).toBeVisible();
});
