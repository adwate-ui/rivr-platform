/**
 * Waitlist (#38, #40, #63), with one member and one host signed in throughout (Auth sends one code a
 * minute to a number): Ishaan Verma (member, identity check finished) and Zoya Sheikh (host). The
 * member joins from Home and the floor removes and adds them; a black card the floor adds (Vihaan
 * Kapoor, seeded with a finished check; never signs in) goes first only at its qualifying stake; and
 * the floor calls the member to a seat, which they see on Home, then seats them.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

const MEMBER = 'Ishaan Verma';
const BLACK_CARD = 'Vihaan Kapoor';

test.describe.configure({ mode: 'serial' });

let player: Page;
let host: Page;

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

/** Presses every button named `name`, one at a time, until none is left. */
async function pressEvery(page: Page, name: string) {
  const buttons = page.getByRole('button', { name });
  while (await buttons.count() > 0) {
    const before = await buttons.count();
    await buttons.first().click();
    await expect(buttons).toHaveCount(before - 1);
  }
}

/** Adds a member to a list by their number. */
async function addByNumber(list: Locator, phone: string) {
  await list.getByRole('textbox', { name: 'Mobile number' }).fill(phone);
  await list.getByRole('button', { name: 'Add to the list' }).click();
}

test.beforeAll(async ({ browser }) => {
  player = await browser.newPage();
  await signInToPlayer(player, '9000000211');
  host = await browser.newPage();
  await signInToConsole(host, '9000000111');
  await host.getByRole('link', { name: 'Waitlist' }).click();
  await expect(host.getByRole('heading', { name: 'NLH 100/200' })).toBeVisible();
  // A run stopped early may have left places behind.
  await pressEvery(player, 'Leave');
  await pressEvery(host, `Remove ${BLACK_CARD}`);
});

/**
 * Reloads the floor's list until it shows what the member just did: the tap's change reaches the database a moment after
 * it, and a reload that reads first would show the list as it was until the next minute's refresh.
 */
async function untilListShows(host: Page, name: string) {
  await expect(async () => {
    await host.reload();
    await expect(gameList(host, 'NLH 100/200').getByRole('button', { name })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

test.describe('Waitlist', () => {
  test('a member joins from Home; the floor sees and removes them, then adds them by number', async () => {
    await joinButton(player, 'Table 2').click();
    await expect(tableDetail(player, 'Table 2').getByText(/· You are number \d+$/)).toBeVisible();
    await expect(player.getByRole('heading', { name: 'Your waitlist' })).toBeVisible();
    await expect(player.getByText(/^Number \d+ · Joined \d{2}:\d{2}$/)).toBeVisible();
    // Table 3 plays the same game and stake, so it shares the one list.
    await expect(tableDetail(player, 'Table 3').getByText(/· You are number \d+$/)).toBeVisible();

    // Staff work at both venues: the console lists only the selected venue's games.
    await host.reload();
    await expect(host.getByRole('heading', { name: 'NLH 100/200' })).toHaveCount(1);
    const higher = gameList(host, 'NLH 100/200');
    await expect(higher.getByText(new RegExp(`^\\d+\\. ${MEMBER} · \\d{2}:\\d{2}$`))).toBeVisible();
    await higher.getByRole('button', { name: `Remove ${MEMBER}` }).click();
    await expect(higher.getByText(MEMBER, { exact: false })).toHaveCount(0);

    await player.reload();
    await expect(joinButton(player, 'Table 2')).toBeVisible();
    await expect(player.getByRole('heading', { name: 'Your waitlist' })).toHaveCount(0);

    const lower = gameList(host, 'NLH 50/100');
    await addByNumber(lower, '9000000211');
    await expect(lower.getByText(new RegExp(`^1\\. ${MEMBER} · `))).toBeVisible();
    await expect(lower.getByText('Added by the floor')).toBeVisible();
    await player.reload();
    await expect(tableDetail(player, 'Table 1').getByText(/· You are number 1$/)).toBeVisible();
  });

  test('Black card at another stake queues by join time, and goes first at its own', async () => {
    // The member is first on 50/100 from the step before.
    const higher = gameList(host, 'NLH 100/200');
    const lower = gameList(host, 'NLH 50/100');
    await addByNumber(higher, '9000000212');
    await expect(higher.getByText(new RegExp(`^1\\. ${BLACK_CARD} · \\d{2}:\\d{2} · Black card$`))).toBeVisible();
    await addByNumber(lower, '9000000212');
    await expect(lower.getByText(new RegExp(`^2\\. ${BLACK_CARD} · \\d{2}:\\d{2}$`))).toBeVisible();
    await pressEvery(host, `Remove ${BLACK_CARD}`);

    await pressEvery(player, 'Leave');
    await host.reload();
    await expect(gameList(host, 'NLH 50/100').getByText('No one is waiting.')).toBeVisible();
  });

  test('Join and seat: the floor calls the member to a seat they see on Home, then seats them', async () => {
    // Tonight's floor (#87): each table's open seats and its wait, the jackpot and the next tournament.
    await player.reload();
    await expect(tableDetail(player, 'Table 2').getByText(/^(\d+ seats? open|Full) · /)).toBeVisible();
    await expect(player.getByText('Bad-beat jackpot')).toBeVisible();
    await expect(player.getByText('Next tournament')).toBeVisible();
    await expect(player.getByText('Weeknight Turbo')).toBeVisible();
    await joinButton(player, 'Table 2').click();
    await expect(tableDetail(player, 'Table 2').getByText(/· You are number \d+$/)).toBeVisible();

    await host.reload();
    const higher = gameList(host, 'NLH 100/200');
    await higher.getByRole('button', { name: `Call ${MEMBER}` }).click();
    await higher.getByRole('button', { name: 'Table 3', exact: true }).click();
    await higher.getByRole('textbox', { name: 'Seat', exact: true }).fill('9');
    await higher.getByRole('button', { name: 'Call to this seat' }).click();
    await expect(higher.getByText(/^Called to Table 3, seat 9 · hold until \d{2}:\d{2}$/)).toBeVisible();

    await player.reload();
    await expect(player.getByText(/^Your seat is ready\. Table 3, seat 9\. Hold expires \d{2}:\d{2}\.$/)).toBeVisible();

    await higher.getByRole('button', { name: `Seat ${MEMBER}` }).click();
    await expect(higher.getByText(MEMBER, { exact: false })).toHaveCount(0);
    await player.reload();
    await expect(player.getByRole('heading', { name: 'Your waitlist' })).toHaveCount(0);
    await expect(joinButton(player, 'Table 2')).toBeVisible();
  });

  test('Skip, Back, Step away and I\u2019m back: the floor and the member move a place to away and back (#287)', async () => {
    await player.reload();
    await joinButton(player, 'Table 2').click();
    await expect(tableDetail(player, 'Table 2').getByText(/· You are number \d+$/)).toBeVisible();

    await host.reload();
    const higher = gameList(host, 'NLH 100/200');
    await higher.getByRole('button', { name: `Call ${MEMBER}` }).click();
    await higher.getByRole('button', { name: 'Table 3', exact: true }).click();
    await higher.getByRole('textbox', { name: 'Seat', exact: true }).fill('8');
    await higher.getByRole('button', { name: 'Call to this seat' }).click();
    await higher.getByRole('button', { name: `Skip ${MEMBER}` }).click();
    await expect(higher.getByRole('button', { name: `${MEMBER} is back` })).toBeVisible();
    await higher.getByRole('button', { name: `${MEMBER} is back` }).click();
    await expect(higher.getByRole('button', { name: `Call ${MEMBER}` })).toBeVisible();

    await player.reload();
    await player.getByRole('button', { name: 'Step away' }).click();
    await untilListShows(host, `${MEMBER} is back`);
    await player.getByRole('button', { name: "I'm back" }).click();
    await untilListShows(host, `Call ${MEMBER}`);

    await pressEvery(player, 'Leave');
  });
});
