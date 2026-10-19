/**
 * Waitlist (#38, #40): a member joins the 100/200 list from Home and sees their place; the floor sees
 * them on the console's Waitlist and removes them, and the member can join again. The floor then
 * adds the member to the 50/100 list by their number, and the member sees that place too. A black
 * card the floor adds goes first on the 100/200 list, the stake it qualifies at, and by join time on
 * 50/100 (Vihaan Kapoor, seeded with a finished check; never signs in).
 * Ishaan Verma (member, identity check finished) and Zoya Sheikh (host) are this flow's own people:
 * Auth sends one code a minute to a number.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

const MEMBER = 'Ishaan Verma';

/** The line under one table on Home: how many wait, or the member's place. */
function tableDetail(page: Page, name: string): Locator {
  return page.locator('div').filter({ has: page.getByText(name, { exact: true }) })
    .filter({ has: page.getByText(/waiting|No wait|You are number|Closed/) }).last();
}

/** One table's Join on Home. */
function joinButton(page: Page, name: string): Locator {
  return page.locator('div').filter({ has: page.getByText(name, { exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Join' }) }).last().getByRole('button', { name: 'Join' });
}

/** The console list for one game and stake, found by its heading. */
function gameList(page: Page, name: string): Locator {
  return page.locator('div').filter({ has: page.getByRole('heading', { name }) })
    .filter({ has: page.getByRole('button', { name: 'Add to the list' }) }).last();
}

/** Leaves every list the member is on, so a run never meets an earlier one's place. */
async function leaveEveryList(page: Page) {
  const leave = page.getByRole('button', { name: 'Leave' });
  while (await leave.count() > 0) {
    const before = await leave.count();
    await leave.first().click();
    await expect(leave).toHaveCount(before - 1);
  }
}

test.describe('Waitlist', () => {
  test('a member joins from Home; the floor removes and adds them; Black card at another stake queues by join time', async ({ browser }) => {
    const player = await browser.newPage();
    await signInToPlayer(player, '9000000211');
    await leaveEveryList(player);

    await joinButton(player, 'Table 2').click();
    await expect(tableDetail(player, 'Table 2').getByText(/· You are number \d+$/)).toBeVisible();
    await expect(player.getByRole('heading', { name: 'Your waitlist' })).toBeVisible();
    await expect(player.getByText(/^Number \d+ · Joined \d{2}:\d{2}$/)).toBeVisible();
    // Table 3 plays the same game and stake, so it shares the one list.
    await expect(tableDetail(player, 'Table 3').getByText(/· You are number \d+$/)).toBeVisible();

    const host = await browser.newPage();
    await signInToConsole(host, '9000000111');
    await host.getByRole('link', { name: 'Waitlist' }).click();
    // Staff work at both venues: the console lists only the selected venue's games.
    await expect(host.getByRole('heading', { name: 'NLH 100/200' })).toHaveCount(1);
    const higher = gameList(host, 'NLH 100/200');
    await expect(higher.getByText(new RegExp(`^\\d+\\. ${MEMBER} · \\d{2}:\\d{2}$`))).toBeVisible();
    await higher.getByRole('button', { name: `Remove ${MEMBER}` }).click();
    await expect(higher.getByText(MEMBER, { exact: false })).toHaveCount(0);

    await player.reload();
    await expect(joinButton(player, 'Table 2')).toBeVisible();
    await expect(player.getByRole('heading', { name: 'Your waitlist' })).toHaveCount(0);

    const lower = gameList(host, 'NLH 50/100');
    await lower.getByRole('textbox', { name: 'Mobile number' }).fill('9000000211');
    await lower.getByRole('button', { name: 'Add to the list' }).click();
    await expect(lower.getByText(new RegExp(`^1\\. ${MEMBER} · `))).toBeVisible();
    await expect(lower.getByText('Added by the floor')).toBeVisible();

    // A black card at 100/200 goes first on that list, with the reason, and by join time on 50/100 (#40).
    await higher.getByRole('textbox', { name: 'Mobile number' }).fill('9000000212');
    await higher.getByRole('button', { name: 'Add to the list' }).click();
    await expect(higher.getByText(/^1\. Vihaan Kapoor · \d{2}:\d{2} · Black card$/)).toBeVisible();
    await lower.getByRole('textbox', { name: 'Mobile number' }).fill('9000000212');
    await lower.getByRole('button', { name: 'Add to the list' }).click();
    await expect(lower.getByText(/^2\. Vihaan Kapoor · \d{2}:\d{2}$/)).toBeVisible();
    await higher.getByRole('button', { name: 'Remove Vihaan Kapoor' }).click();
    await lower.getByRole('button', { name: 'Remove Vihaan Kapoor' }).click();
    await expect(host.getByText(/Vihaan Kapoor/)).toHaveCount(0);

    await player.reload();
    await expect(tableDetail(player, 'Table 1').getByText(/· You are number 1$/)).toBeVisible();
    await leaveEveryList(player);
    await host.reload();
    await expect(gameList(host, 'NLH 50/100').getByText('No one is waiting.')).toBeVisible();
  });
});
