/**
 * Waitlist (#38, #40, #63), with one member and one host signed in throughout (Auth sends one code a
 * minute to a number): Ishaan Verma (member, identity check finished) and Zoya Sheikh (host). The
 * member asks to join a table's list from Tonight (a list per table, decision 0433), and the floor approves the request onto
 * it (#633), removes them and adds them, one list at a time; a black card the floor adds (Vihaan Kapoor, seeded with a
 * finished check; never signs in) goes first only at its qualifying stake; and the floor assigns the member a seat at the
 * list's table, which they see on Tonight. Titles follow the prototype's panel (decision 0320).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

const MEMBER = 'Ishaan Verma';
const BLACK_CARD = 'Vihaan Kapoor';

test.describe.configure({ mode: 'serial' });

let player: Page;
let host: Page;

/** One table's row in Tonight's tables, which opens its join sheet: `Table 2 · NLH 100/200`. */
function tableRow(page: Page, name: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^${name} · `) });
}

/** Joins at a table from its sheet, and waits for the sheet to close. */
async function joinAt(page: Page, name: string) {
  await tableRow(page, name).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: /^(Take a seat|Join waitlist)$/ }).click();
  await expect(sheet).toHaveCount(0);
}

/** Leaves the list the member's Tonight shows, until it shows none. */
async function leaveEveryList(page: Page) {
  await page.reload();
  const leave = page.getByRole('button', { name: 'Leave waitlist' });
  await expect(page.getByRole('region', { name: 'All tables' }).or(leave).or(page.getByRole('timer')).first()).toBeVisible();
  while (await leave.count() > 0) {
    await leave.click();
    await expect(leave).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('region', { name: 'All tables' }).or(leave).or(page.getByRole('timer')).first()).toBeVisible();
  }
}

const IN_LINE = /^(Next|\d+(st|nd|rd|th)) in line$/;

/** The console list for one table (decision 0433), found by its heading. */
function gameList(page: Page, name: string): Locator {
  return page.locator('div').filter({ has: page.getByRole('heading', { name, exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Add to the list' }) }).last();
}

/** Presses every button named `name`, one at a time, until none is left. */
async function pressEvery(page: Page, name: string | RegExp, confirm: string) {
  const buttons = page.getByRole('button', { name, exact: true });
  while (await buttons.count() > 0) {
    const before = await buttons.count();
    await buttons.first().click();
    // Each is asked twice (B7): the button turns into its confirmation.
    await page.getByRole('button', { name: confirm }).click();
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
  await expect(host.getByRole('heading', { name: 'Table 2', exact: true })).toBeVisible();
  // A run stopped early may have left places behind.
  await leaveEveryList(player);
  await pressEvery(host, `Remove ${BLACK_CARD}`, `Yes, remove ${BLACK_CARD}`);
  await pressEvery(host, `Remove ${MEMBER}`, `Yes, remove ${MEMBER}`);
});

/**
 * Reloads the floor's list until it shows what the member just did: the tap's change reaches the database a moment after
 * it, and a reload that reads first would show the list as it was until the next minute's refresh.
 */
async function untilListShows(host: Page, name: string) {
  await expect(async () => {
    await host.reload();
    await expect(gameList(host, 'Table 2').getByRole('button', { name })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

/** The member asks to join at Table 2 from Tonight, and the floor approves the request onto the list (#633). */
async function joinAndApprove(player: Page, host: Page) {
  await joinAt(player, 'Table 2');
  await expect(player.getByText('Requested', { exact: true })).toBeVisible();
  await untilListShows(host, `Approve ${MEMBER}`);
  // The host's menu counts the join waiting, and the tab leads with the urgent count (decision 0301).
  await expect(host.getByRole('link', { name: 'Waitlist', exact: true })).toHaveAccessibleDescription(/^\d+ waiting$/, { timeout: 15_000 });
  await expect(host).toHaveTitle(/^\(\d+\) /);
  await gameList(host, 'Table 2').getByRole('button', { name: `Approve ${MEMBER}` }).click();
  await player.reload();
  await expect(player.getByText(IN_LINE)).toBeVisible();
}

test.describe('Waitlist', () => {
  test('Tonight › Join sheet, On the list: a member asks to join at a table; the floor approves, removes them, then adds them by number', async () => {
    await joinAt(player, 'Table 2');
    await expect(player.getByText('Joined waitlist')).toBeVisible();
    await expect(player.getByText('Waitlist · Table 2 · NLH 100/200')).toBeVisible();
    await expect(player.getByText('Requested', { exact: true })).toBeVisible();
    await expect(player.getByText(/^Joined \d{2}:\d{2}$/)).toBeVisible();
    // One game at a time (#633): while the member waits, the tables only show, with no join.
    await expect(tableRow(player, 'Table 2')).toHaveCount(0);

    // Staff work at both venues: the console lists only the selected venue's tables.
    await host.reload();
    await expect(host.getByRole('heading', { name: 'Table 2', exact: true })).toHaveCount(1);
    const higher = gameList(host, 'Table 2');
    await expect(higher.getByText(new RegExp(`^${MEMBER} · asked at \\d{2}:\\d{2}$`))).toBeVisible();
    await higher.getByRole('button', { name: `Approve ${MEMBER}` }).click();
    await player.reload();
    await expect(player.getByText(IN_LINE)).toBeVisible();
    await expect(player.getByText('Waitlist · Table 2 · NLH 100/200')).toBeVisible();

    await expect(higher.getByText(new RegExp(`^\\d+\\. ${MEMBER} · \\d{2}:\\d{2}$`))).toBeVisible();
    await higher.getByRole('button', { name: `Remove ${MEMBER}` }).click();
    await higher.getByRole('button', { name: `Yes, remove ${MEMBER}` }).click();
    await expect(higher.getByText(MEMBER, { exact: false })).toHaveCount(0);

    await player.reload();
    await expect(tableRow(player, 'Table 2')).toBeVisible();
    await expect(player.getByRole('button', { name: 'Leave waitlist' })).toHaveCount(0);

    const lower = gameList(host, 'Table 1');
    await addByNumber(lower, '9000000211');
    await expect(lower.getByText(new RegExp(`^1\\. ${MEMBER} · `))).toBeVisible();
    await expect(lower.getByText('Added by the floor')).toBeVisible();
    // Added by the floor, the place names the table whose list it is on.
    await player.reload();
    await expect(player.getByText('Next in line')).toBeVisible();
    await expect(player.getByText('Waitlist · Table 1 · NLH 50/100')).toBeVisible();
  });

  test('Black card at another stake queues by join time, and goes first at its own', async () => {
    // The member is first on Table 1's list (50/100) from the step before.
    const higher = gameList(host, 'Table 2');
    const lower = gameList(host, 'Table 1');
    await addByNumber(higher, '9000000212');
    await expect(higher.getByText(new RegExp(`^1\\. ${BLACK_CARD} · \\d{2}:\\d{2} · Black card$`))).toBeVisible();
    // One list at a time (#633): off Table 2's before Table 1's.
    await higher.getByRole('button', { name: `Remove ${BLACK_CARD}` }).click();
    await higher.getByRole('button', { name: `Yes, remove ${BLACK_CARD}` }).click();
    await expect(higher.getByText(BLACK_CARD, { exact: false })).toHaveCount(0);
    await addByNumber(lower, '9000000212');
    await expect(lower.getByText(new RegExp(`^2\\. ${BLACK_CARD} · \\d{2}:\\d{2}$`))).toBeVisible();
    await pressEvery(host, `Remove ${BLACK_CARD}`, `Yes, remove ${BLACK_CARD}`);

    await leaveEveryList(player);
    await host.reload();
    await expect(gameList(host, 'Table 1').getByText('No one is waiting.')).toBeVisible();
  });

  test('Tonight › Browsing, Seated: the floor assigns the member a seat at the list\u2019s table and a call time, and they see it on Tonight (decision 0299)', async () => {
    // Tonight's floor (#87): each table's open seats and its wait; its call time in the join sheet (#633); the upcoming
    // tournaments (#636); no jackpot (#627).
    await player.reload();
    await expect(tableRow(player, 'Table 2')).toContainText(/(\d+ open|Full)/);
    await tableRow(player, 'Table 2').click();
    await expect(player.getByRole('dialog').getByText('3 h', { exact: true })).toBeVisible();
    await player.keyboard.press('Escape');
    await expect(player.getByText('Bad-beat jackpot')).toHaveCount(0);
    await expect(player.getByRole('heading', { name: 'Tournaments' })).toBeVisible();
    await expect(player.getByText('Weeknight Turbo')).toBeVisible();
    await joinAndApprove(player, host);

    await host.reload();
    const higher = gameList(host, 'Table 2');
    await higher.getByRole('button', { name: `Assign ${MEMBER}` }).click();
    // A place is assigned only at its list's table (decision 0433): Table 2, chosen already.
    await expect(higher.getByRole('button', { name: 'Table 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await higher.getByRole('group', { name: 'Seat', exact: true }).getByRole('button', { name: '9', exact: true }).click();
    await higher.getByRole('group', { name: 'Call time' }).getByRole('button', { name: '4 h', exact: true }).click();
    await higher.getByRole('button', { name: 'Assign', exact: true }).click();
    // Assigned is seated: off the list at once, with no hold to wait out.
    await expect(higher.getByText(MEMBER, { exact: false })).toHaveCount(0);
    await player.reload();
    await expect(player.getByRole('button', { name: 'Leave waitlist' })).toHaveCount(0);
    // Seated, he joins no other game from the app (#633): the tables only show.
    await expect(player.getByRole('heading', { name: 'Table 2 · Seat 9' })).toBeVisible();
    await expect(tableRow(player, 'Table 2')).toHaveCount(0);
  });

  test('Hold place and Back: the floor holds a member\u2019s place and brings it back; the member has no Step away', async () => {
    // Seated from the step before, the member is on a list only as the floor adds him, to change tables (#633): Table 3's.
    await host.reload();
    await addByNumber(gameList(host, 'Table 3'), '9000000211');

    await host.reload();
    const higher = gameList(host, 'Table 3');
    await higher.getByRole('button', { name: `Hold place: ${MEMBER}` }).click();
    await higher.getByRole('button', { name: `Yes, hold ${MEMBER}’s place` }).click();
    await expect(higher.getByRole('button', { name: `Back: ${MEMBER}` })).toBeVisible();
    await higher.getByRole('button', { name: `Back: ${MEMBER}` }).click();
    await expect(higher.getByRole('button', { name: `Assign ${MEMBER}` })).toBeVisible();

    // Only the floor holds a place now (decision 0300): the member's Tonight offers no Step away.
    await player.reload();
    await expect(player.getByRole('heading', { name: 'Table 2 · Seat 9' })).toBeVisible();
    await expect(player.getByRole('button', { name: /^Step away/ })).toHaveCount(0);

    await pressEvery(host, `Remove ${MEMBER}`, `Yes, remove ${MEMBER}`);
  });
});
