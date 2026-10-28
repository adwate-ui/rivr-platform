// Winner card (#155): a winner's card reaches staff who publish marketing only while the winner shares it, and stopping
// takes it down. The seed has drawn Kavya's card for the Weeknight Turbo; the flow uploads its image as the nightly job
// would, with the service role, so it runs against the local stack only.
import { expect, test, type Page } from '@playwright/test';
import { localSupabaseEnv } from '@rivr/config/worktree';
import { isRemoteTarget } from '../support/apps.ts';
import { serviceRoleKey } from '../support/serviceRole.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

const IMAGE = '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000009c1.png';
// A one-pixel PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

const SHARE = /^Share Weeknight Turbo: ₹1,20,000 from .+ on RIVR's social$/;

async function sharedCards(staff: Page) {
  await staff.reload();
  return staff.getByRole('table', { name: 'Winner cards shared by their players' });
}

test('Winner card: shared by its winner it reaches marketing, and stopping takes it down', async ({ browser, request }) => {
  test.skip(isRemoteTarget(), 'uploads with the service role, so the local stack only');
  const { url } = localSupabaseEnv();
  const service = serviceRoleKey();
  const upload = await request.post(`${url}/storage/v1/object/winner-cards/${IMAGE}`, {
    headers: { apikey: service, authorization: `Bearer ${service}`, 'content-type': 'image/png', 'x-upsert': 'true' },
    data: PNG,
  });
  expect(upload.ok()).toBe(true);
  const member = await (await browser.newContext()).newPage();
  const staff = await (await browser.newContext()).newPage();
  await signInToPlayer(member, '9000000639');
  await member.getByRole('link', { name: 'Profile' }).click();
  await expect(member.getByText('Weeknight Turbo: ₹1,20,000', { exact: true })).toBeVisible();
  await expect(member.getByRole('link', { name: 'See the card' })).toBeVisible();
  await expect(member.getByRole('switch', { name: SHARE })).not.toBeChecked();

  await signInToConsole(staff, '9000000640');
  await staff.getByRole('link', { name: 'Social' }).click();
  await expect(staff.getByText('No winner has shared a card yet.')).toBeVisible();

  await member.getByRole('switch', { name: SHARE }).click();
  await expect(member.getByRole('switch', { name: SHARE })).toBeChecked();
  const row = (await sharedCards(staff)).getByRole('row').filter({ hasText: 'Kavya R.' });
  await expect(row).toContainText('Weeknight Turbo');
  await expect(row).toContainText('₹1,20,000');
  await expect(row.getByRole('link', { name: 'Card for Kavya R.' })).toHaveAttribute('href', /\/winner-cards\/.+\.png\?token=.+&download=/);

  await member.getByRole('switch', { name: SHARE }).click();
  await expect(member.getByRole('switch', { name: SHARE })).not.toBeChecked();
  await sharedCards(staff);
  await expect(staff.getByText('No winner has shared a card yet.')).toBeVisible();
});
