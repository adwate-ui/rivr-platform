/**
 * Tournament interest (#636) and tournaments without money (#800, decision 0441). Leela Pillai, this flow's own admin,
 * publishes a tournament for the day after tomorrow from the Waitlist's Tournament interest tab (console v3), with a name of the
 * run's own, its game and stake as text and no buy-in. Ajay Dhillon, this flow's own member, sees it under Tournaments
 * in Tonight's tables with no buy-in, and asks to be notified (decision 0320). Leela finds him on the same screen and
 * marks him registered once he paid at the club, takes it back with the toast's Undo, and marks him again; his Tonight then
 * says Registered. The rules are proved in
 * supabase/tests/204_tournament_interest.test.sql, 292_tournaments_without_money.test.sql and 296_tournament_registration_undo.test.sql.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';
import { openTab } from '../support/console.ts';

/** The IST day two days from now, as a date field takes it: `2026-11-05`. */
const dayAfterTomorrow = () => new Date(Date.now() + 2 * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

test.describe('Tournament interest', () => {
  test('the club publishes a tournament without money, a member registers interest, and the floor marks him registered', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'publishes a tournament in the local database, so the local stack only');
    test.setTimeout(90_000);
    const name = `Interest Cup ${String(Date.now() % 100_000).padStart(5, '0')}`;

    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000116');
    await openTab(floor, 'Waitlist', 'Tournament interest');
    await expect(floor.getByRole('heading', { name: 'New tournament' })).toBeVisible();
    await expect(floor.getByLabel(/buy-in|prize|guarantee/i)).toHaveCount(0);
    await floor.getByRole('textbox', { name: 'Name' }).fill(name);
    await floor.getByLabel('Day').fill(dayAfterTomorrow());
    await floor.getByRole('textbox', { name: 'Start time' }).fill('16:00');
    await floor.getByRole('textbox', { name: 'Game' }).fill('No-limit hold’em');
    await floor.getByRole('textbox', { name: 'Stake' }).fill('25,000 chips');
    await floor.getByRole('textbox', { name: 'Description' }).fill('Twenty-minute levels.');
    await floor.getByRole('button', { name: 'Publish' }).click();
    await expect(floor.getByText(`${name} published.`)).toBeVisible();

    const member = await browser.newPage();
    await signInToPlayer(member, '9000000408');
    await expect(member.getByRole('heading', { name: 'Tournaments', exact: true })).toBeVisible();
    await expect(member.getByText(name, { exact: true })).toBeVisible();
    await expect(member.getByText(/₹/)).toHaveCount(0);
    await member.getByRole('button', { name: `Register interest in ${name}` }).click();
    // Notify me becomes Notifying you (decision 0320); the floor registers them once they pay at the club.
    await expect(member.getByRole('button', { name: `Register interest in ${name}` })).toHaveText('Notifying you');

    await floor.reload();
    await expect(floor.getByRole('heading', { name, exact: true })).toBeVisible();
    const card = floor.locator('section').filter({ has: floor.getByRole('heading', { name, exact: true }) });
    await card.getByRole('button', { name: 'Mark Ajay Dhillon registered' }).click();
    await expect(card.getByText('Registered', { exact: true })).toBeVisible();
    await expect(card.getByText('1 interested · 1 registered')).toBeVisible();
    // Undo takes the registration back through its own function (console v3); then the floor marks him again.
    await floor.getByRole('button', { name: 'Undo' }).click();
    await expect(card.getByRole('button', { name: 'Mark Ajay Dhillon registered' })).toBeVisible();
    await card.getByRole('button', { name: 'Mark Ajay Dhillon registered' }).click();
    await expect(card.getByText('Registered', { exact: true })).toBeVisible();

    await member.reload();
    await expect(member.getByText(name, { exact: true }).locator('xpath=../..').getByText('Registered', { exact: true })).toBeVisible();
  });
});
