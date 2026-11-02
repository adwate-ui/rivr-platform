/**
 * Notices (decision 0298): a super admin puts a notice up in Settings, a member reads it at the top of Home, and once it
 * is ended it is gone. Aisha Khan (126) and Bhuvan Walia (426) are this flow's own, as Auth sends one code a minute.
 */
import { expect, test } from '@playwright/test';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

test('Notices: a notice put up in Settings shows on members\' Home until it is ended', async ({ browser, page }) => {
  const words = `Valet parking from 8 pm tonight (${String(Date.now())}).`;
  await signInToConsole(page, '9000000126');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('link', { name: 'Notices', exact: true }).click();
  await page.getByRole('textbox', { name: 'Notice' }).fill(words);
  await page.getByRole('button', { name: 'Put up' }).click();
  await expect(page.getByRole('status').getByText('Notice put up.')).toBeVisible();

  const member = await (await browser.newContext()).newPage();
  await signInToPlayer(member, '9000000426');
  await expect(member.getByText(words)).toBeVisible();

  await page.getByRole('button', { name: `End the notice: ${words}` }).click();
  await page.getByRole('button', { name: 'Yes, end it' }).click();
  await expect(page.getByRole('status').getByText('Notice ended.')).toBeVisible();
  await member.reload();
  await expect(member.getByRole('heading', { name: 'Tonight' })).toBeVisible();
  await expect(member.getByText(words)).toHaveCount(0);
});
