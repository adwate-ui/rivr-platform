/**
 * Publish a promotion (#84, #86; design prompt flow 7): the floor manager opens Promotions, builds
 * Thursday 14:00 to 20:00, 100/200, double points, no limits, sees the player card and the TV slide
 * previewed, and submits it; Arjun Batra, a super admin, approves it and it runs (#144). The member's Home shows
 * the card, and a TV on Promotions shows the slide. 180 Tara, 759 Arjun and 280 Rhea are the flow's own: Auth sends
 * one code a minute to a number.
 */
import { expect, test, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget, VIEWPORT } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

const RUNS = 'NLH 100/200 · Thursday, 14:00 to 20:00';

/** Builds flow 7 in the builder and submits it; a super admin approves it. */
async function publishFlow7(floor: Page, approver: Page) {
  await floor.getByRole('link', { name: 'Promotions' }).click();
  await expect(floor.getByRole('heading', { name: 'New promotion' })).toBeVisible({ timeout: 5000 });
  await floor.getByRole('group', { name: 'Days' }).getByRole('button', { name: 'Thursday' }).click();
  await floor.getByRole('group', { name: 'From' }).getByRole('button', { name: '14:00' }).click();
  await floor.getByRole('group', { name: 'To' }).getByRole('button', { name: '20:00' }).click();
  await floor.getByRole('group', { name: 'Who' }).getByRole('button', { name: 'NLH 100/200' }).click();
  await expect(floor.getByRole('group', { name: 'Reward' }).getByRole('button', { name: 'Double points' })).toHaveAttribute('aria-pressed', 'true');
  await expect(floor.getByRole('group', { name: 'Limits' }).getByRole('button', { name: 'None' })).toHaveAttribute('aria-pressed', 'true');
  // The player card and the TV slide, as the choices would publish them.
  await expect(floor.getByRole('article', { name: 'Double points' })).toContainText(RUNS);
  await expect(floor.getByRole('group', { name: 'TV slide' })).toContainText(RUNS);
  // Simulated on last week first, then submitted; a super admin approves it (#144).
  await floor.getByRole('button', { name: 'Simulate last week' }).click();
  await expect(floor.getByText('Times given', { exact: true })).toBeVisible({ timeout: 10_000 });
  await floor.getByRole('button', { name: 'Submit for approval', exact: true }).click();
  await expect(floor.getByText('Double points waits for a super admin to approve it.')).toBeVisible({ timeout: 10_000 });
  await approver.getByRole('link', { name: 'Promotions' }).click();
  const waitingList = approver.getByRole('heading', { name: 'Waiting for approval' }).locator('xpath=..');
  const waiting = waitingList.getByText(RUNS, { exact: true }).first().locator('xpath=../..');
  await waiting.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(approver.getByText('Double points is live.')).toBeVisible({ timeout: 10_000 });
  await expect(approver.getByText('Live', { exact: true }).first()).toBeVisible();
}

/** Pairs a TV on the console's TVs screen by the code it shows, and sets it to Promotions. */
async function pairTvOnPromotions(tv: Page, floor: Page, name: string) {
  await tv.setViewportSize(VIEWPORT.display);
  await tv.goto(appUrl('display'));
  const shown = tv.getByRole('heading', { level: 2, name: /^\d{6}$/ });
  await expect(shown).toBeVisible();
  await floor.getByRole('link', { name: 'TVs' }).click();
  await floor.getByRole('textbox', { name: 'Code on the TV' }).fill((await shown.textContent()) ?? '');
  await floor.getByRole('textbox', { name: 'TV name' }).fill(name);
  await floor.getByRole('button', { name: 'Pair the TV' }).click();
  await expect(floor.getByText(`${name} is paired. It shows its mode within a few seconds.`)).toBeVisible();
  await floor.getByRole('group', { name: `What ${name} shows`, exact: true }).getByRole('button', { name: 'Promotions', exact: true }).click();
}

test.describe('Promotions', () => {
  test('Publish a promotion: Thursday 14:00 to 20:00 at 100/200, double points, no limits; the card on Home, the slide on the TV', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'publishes a promotion and pairs a TV, so the local stack only');
    test.setTimeout(120_000);
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000180');
    const approver = await browser.newPage();
    await signInToConsole(approver, '9000000759');
    await publishFlow7(floor, approver);

    const member = await browser.newPage();
    await signInToPlayer(member, '9000000280');
    const card = member.getByRole('region', { name: 'Promotions' }).getByRole('article', { name: 'Double points' });
    await expect(card).toContainText(RUNS, { timeout: 15_000 });

    const name = `TV ${String(Date.now() % 100_000).padStart(5, '0')}`;
    const tv = await browser.newPage();
    await pairTvOnPromotions(tv, floor, name);
    await expect(tv.getByRole('heading', { level: 1, name: 'Double points' }).first()).toBeVisible({ timeout: 20_000 });
    await expect(tv.getByText(RUNS).first()).toBeVisible();

    await floor.getByRole('button', { name: `Unpair ${name}`, exact: true }).click();
    await floor.getByRole('textbox', { name: 'Why it is unpaired' }).fill('End of the test run');
    await floor.getByRole('button', { name: 'Unpair the TV' }).click();
  });
});
