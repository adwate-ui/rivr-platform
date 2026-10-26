/**
 * Rewards and the TV (#148, #152; decisions 0181 to 0183). Riya Sen, this flow's own member with the seed's
 * 20,000 points, opens Rewards in the player app: her points and tier, the catalogue, the League. She
 * redeems a bar upgrade, which asks first and then says where to collect it, and finds it under her
 * redemptions. Meher Lal, its own floor manager, pairs a TV on the rewards ticker, which shows her
 * redemption; turned to the League leaderboard, the TV shows the League. Meher hands the upgrade over on
 * the console, and Riya's app says it was collected. The TV is unpaired at the end. Who may redeem, and
 * that points never go below nothing, is proved in supabase/tests/099 and 101.
 */
import { expect, test, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget, VIEWPORT } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

const REWARD = 'Bar upgrade, one night';

/** Riya redeems the bar upgrade from the catalogue. */
async function redeem(member: Page) {
  await member.getByRole('link', { name: 'Rewards' }).click();
  await expect(member.getByRole('heading', { name: 'Rewards', level: 1 })).toBeVisible();
  await expect(member.getByText('Your tier: Member')).toBeVisible({ timeout: 10_000 });
  await expect(member.getByRole('heading', { name: 'RIVR League' })).toBeVisible();
  await member.getByRole('button', { name: `Redeem ${REWARD}` }).click();
  await expect(member.getByText(`Redeem ${REWARD} for 2,500 points?`)).toBeVisible();
  await member.getByRole('button', { name: 'Yes, redeem' }).click();
  await expect(member.getByText('Redeemed. At the Glaza bar.')).toBeVisible({ timeout: 10_000 });
  await expect(member.getByText(`${REWARD} · 2,500 points`).first()).toBeVisible();
  await expect(member.getByText('To collect: At the Glaza bar').first()).toBeVisible();
}

/** Pairs a TV on the console's TVs screen by the code it shows, and gives it a board. */
async function pairTv(tv: Page, floor: Page, name: string, board: string) {
  await tv.setViewportSize(VIEWPORT.display);
  await tv.goto(appUrl('display'));
  const shown = tv.getByRole('heading', { level: 2, name: /^\d{6}$/ });
  await expect(shown).toBeVisible();
  await floor.getByRole('link', { name: 'TVs' }).click();
  await floor.getByRole('textbox', { name: 'Code on the TV' }).fill((await shown.textContent()) ?? '');
  await floor.getByRole('textbox', { name: 'TV name' }).fill(name);
  await floor.getByRole('button', { name: 'Pair the TV' }).click();
  await expect(floor.getByText(`${name} is paired. It shows its mode within a few seconds.`)).toBeVisible();
  await floor.getByRole('group', { name: `What ${name} shows`, exact: true }).getByRole('button', { name: board, exact: true }).click();
}

test.describe('Rewards', () => {
  test('Rewards and the TV: a member redeems from the app, the TV ticker shows it, the floor hands it over', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'redeems points and pairs a TV, so the local stack only');
    test.setTimeout(150_000);
    const member = await browser.newPage();
    await signInToPlayer(member, '9000000702');
    await redeem(member);

    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000703');
    const tv = await browser.newPage();
    const name = `TV ${String(Date.now() % 100_000).padStart(5, '0')}`;
    await pairTv(tv, floor, name, 'Rewards ticker');
    await expect(tv.getByRole('heading', { name: 'Rewards' })).toBeVisible({ timeout: 20_000 });
    await expect(tv.getByRole('region', { name: 'Just redeemed' }).getByText(REWARD).first()).toBeVisible();
    await expect(tv.getByRole('region', { name: 'Just redeemed' }).getByText('Riya S.').first()).toBeVisible();
    await floor.getByRole('group', { name: `What ${name} shows`, exact: true }).getByRole('button', { name: 'League leaderboard', exact: true }).click();
    await expect(tv.getByRole('heading', { name: 'RIVR League' })).toBeVisible({ timeout: 20_000 });

    await floor.getByRole('link', { name: 'Rewards', exact: true }).click();
    await floor.getByRole('button', { name: `Hand ${REWARD} over to Riya Sen` }).first().click();
    await expect(floor.getByText(/^Meher Lal, /).first()).toBeVisible();

    await member.reload();
    await expect(member.getByText(/^Collected /).first()).toBeVisible({ timeout: 10_000 });

    await floor.getByRole('link', { name: 'TVs' }).click();
    await floor.getByRole('button', { name: `Unpair ${name}`, exact: true }).click();
    await floor.getByRole('textbox', { name: 'Why it is unpaired' }).fill('End of the test run');
    await floor.getByRole('button', { name: 'Unpair the TV' }).click();
  });
});
