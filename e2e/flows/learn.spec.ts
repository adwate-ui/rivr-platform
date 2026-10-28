/**
 * Learn (#133, #136; design flow 11). Dev Malhotra, this flow's own super admin, uploads a licensed encoding; Mira
 * Shah, its own member, opens it in the library, reads its hub, drills ten spots on the table drawing and the pad,
 * each with its verdict, and the summary shows the points earned; Rewards rises by the same amount. Points, caps and
 * sync are proved in supabase/tests/180_learn_progress.test.sql; who sees which title in 181.
 */
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { appUrl } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

const VERDICT = /^(Correct|Too loose|Too tight|Too passive|Too aggressive|Right action, wrong size|Right idea, wrong spot)$/;
const EXAMPLE = join(import.meta.dirname, '..', '..', 'packages', 'drills', 'fixtures', 'example-encoding.json');

/** The member's points on Rewards. */
async function pointsOf(member: Page): Promise<number> {
  await member.goto(`${appUrl('player')}/rewards`);
  const figure = member.getByText('Points', { exact: true }).locator('xpath=following-sibling::*[1]');
  return Number((await figure.textContent())?.replace(/[^0-9]/g, '') ?? 'NaN');
}

/** One spot: the first action offered, the first size where it takes one, then Answer and the verdict. */
async function answerSpot(member: Page, isLast: boolean) {
  await member.getByRole('group', { name: 'Your action' }).getByRole('button').first().click();
  const size = member.getByRole('group', { name: 'How much' });
  if (await size.count() > 0) await size.getByRole('button').first().click();
  await member.getByRole('button', { name: 'Answer' }).click();
  await expect(member.getByRole('status').filter({ hasText: VERDICT })).toBeVisible();
  await member.getByRole('button', { name: isLast ? 'See summary' : 'Next spot' }).click();
}

test.describe('Learn', () => {
  test('Learn: a member drills ten spots of a licensed title and earns its points', async ({ page, browser }) => {
    await signInToConsole(page, '9000000631');
    await page.getByRole('link', { name: 'Learn sources' }).click();
    await page.locator('input[type="file"]').setInputFiles(EXAMPLE);
    await expect(page.getByText(/passed the validator and all eight gates\.$/)).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('Licence ends on').fill(`${String(new Date().getFullYear() + 1)}-03-31`);
    await page.getByRole('textbox', { name: 'Licence terms' }).fill('Licensed to the club for its members');
    await page.getByRole('button', { name: 'Upload source' }).click();
    await expect(page.getByText(/is added\. Members have it until /)).toBeVisible();

    const member = await browser.newPage();
    await signInToPlayer(member, '9000000630');
    const before = await pointsOf(member);
    await member.goto(`${appUrl('player')}/learn`);
    await expect(member.getByRole('heading', { name: 'RIVR Academy levels' })).toBeVisible();
    await member.getByRole('button', { name: 'Schema Demonstration' }).click();
    await expect(member.getByText('Due now')).toBeVisible({ timeout: 20_000 });
    for (const tile of ['Mastery', 'Answered', 'Accuracy']) await expect(member.getByText(tile, { exact: true })).toBeVisible();
    await member.getByRole('group', { name: 'Spots' }).getByRole('button', { name: '10' }).click();
    await member.getByRole('button', { name: 'Start drill' }).click();
    await expect(member.getByRole('heading', { name: 'Action so far' })).toBeVisible();
    for (let spot = 1; spot <= 10; spot += 1) await answerSpot(member, spot === 10);
    await expect(member.getByRole('heading', { name: 'Summary' })).toBeVisible();
    const earned = member.getByText('Points earned').locator('xpath=following-sibling::*[1]');
    await expect(earned).toHaveText(/^[0-9]+$/, { timeout: 20_000 });
    const points = Number(await earned.textContent());
    expect(points).toBeGreaterThan(0);
    await member.getByRole('button', { name: 'Review' }).click();
    await expect(member.getByRole('table', { name: 'Accuracy by street and position' })).toBeVisible();
    expect(await pointsOf(member)).toBe(before + points);

    // A book that ships with RIVR (decision 0274) opens at its hub, with no upload.
    await member.goto(`${appUrl('player')}/learn`);
    await member.getByRole('button', { name: "How To Read Hands At No-Limit Hold'em" }).click();
    await expect(member.getByRole('heading', { name: "How To Read Hands At No-Limit Hold'em", level: 1 })).toBeVisible();
    await expect(member.getByText('Mastery', { exact: true })).toBeVisible();
  });
});
