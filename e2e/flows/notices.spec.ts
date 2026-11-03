/**
 * Notices (decisions 0298 and 0424): a super admin puts a notice up in Settings, a member reads it on Tonight as a card
 * with nothing to close it, the admin edits its words in place and the member reads the new ones, and once it is ended it
 * is gone. Aisha Khan (126) and Bhuvan Walia (426) are this flow's own, as Auth sends one code a minute.
 */
import { expect, test } from '@playwright/test';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';
import { openConsole } from '../support/console.ts';

test('Notices: a notice put up in Settings shows on members\' Home, is edited in place, and goes once ended', async ({ browser, page }) => {
  const words = `Valet parking from 8 pm tonight (${String(Date.now())}).`;
  const edited = words.replace('8 pm', '9 pm');
  await signInToConsole(page, '9000000126');
  await openConsole(page, '/settings?tab=settings&part=notices');
  await page.getByRole('textbox', { name: 'Notice' }).fill(words);
  await page.getByRole('button', { name: 'Put up' }).click();
  await expect(page.getByRole('status').getByText('Notice put up.')).toBeVisible();

  const member = await (await browser.newContext()).newPage();
  await signInToPlayer(member, '9000000426');
  const card = member.getByRole('article', { name: 'From the club' }).filter({ hasText: words });
  await expect(card).toBeVisible();
  await expect(card.getByRole('button')).toHaveCount(0);

  await page.getByRole('button', { name: `Edit the notice: ${words}` }).click();
  await page.getByRole('textbox', { name: 'Notice' }).fill(edited);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status').getByText('Notice saved.')).toBeVisible();
  await member.reload();
  await expect(member.getByText(edited)).toBeVisible();

  await page.getByRole('button', { name: `End the notice: ${edited}` }).click();
  await page.getByRole('button', { name: 'Yes, end it' }).click();
  await expect(page.getByRole('status').getByText('Notice ended.')).toBeVisible();
  await member.reload();
  await expect(member.getByRole('heading', { name: 'Tonight', level: 1 })).toBeVisible();
  await expect(member.getByText(edited)).toHaveCount(0);
});
