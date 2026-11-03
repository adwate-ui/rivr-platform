/**
 * Waitlist (#38, #40, #63), with one member and one host signed in throughout (Auth sends one code a
 * minute to a number): Ishaan Verma (member, identity check finished) and Zoya Sheikh (host). The
 * member asks to join a table's list from Tonight (a list per table, decision 0433), and the floor approves the request onto
 * it (#633), removes them and adds them, one list at a time; a black card the floor adds (Vihaan Kapoor, seeded with a
 * finished check; never signs in) goes first only at its qualifying stake; and the floor assigns the member a seat at the
 * list's table, which they see on Tonight. Titles follow the prototype's panel (decision 0320). The console's Waitlist is
 * the redesign's (console v3): a card for each table's list, a ⋯ menu on each place, the bulk bar over the places ticked.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { appUrl } from '../support/apps.ts';
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

/** The console's card for one table's list (decision 0433), found by its heading. */
function gameList(page: Page, name: string): Locator {
  return page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name, exact: true }) });
}

/** A place's row on a card: its number, the name, how long and what to know, then Seat and its ⋯ menu. */
function placeRow(list: Locator, name: string): Locator {
  return list.locator('div').filter({ has: list.page().getByRole('button', { name: `More for ${name}`, exact: true }) })
    .filter({ has: list.page().getByRole('checkbox', { name: `Select ${name}` }) }).last();
}

/** Takes every place of `name` off the lists, from each place's ⋯ menu, asked first. */
async function removeEvery(page: Page, name: string) {
  const menus = page.getByRole('button', { name: `More for ${name}`, exact: true });
  while (await menus.count() > 0) {
    const before = await menus.count();
    await menus.first().click();
    await page.getByRole('menuitem', { name: 'Remove from list' }).click();
    await page.getByRole('button', { name: `Yes, remove ${name}` }).click();
    await expect(menus).toHaveCount(before - 1);
  }
}

/** Adds a member to a list by their mobile number or membership number. */
async function addByNumber(list: Locator, number: string) {
  await list.getByRole('textbox', { name: 'Add: mobile or member no.' }).fill(number);
  await list.getByRole('button', { name: 'Add', exact: true }).click();
}

test.beforeAll(async ({ browser }) => {
  player = await browser.newPage();
  await signInToPlayer(player, '9000000211');
  host = await browser.newPage();
  await signInToConsole(host, '9000000111');
  await host.goto(`${appUrl('console')}/waitlist`);
  await expect(host.getByRole('heading', { name: 'Table 2', exact: true })).toBeVisible();
  // A run stopped early may have left places behind.
  await leaveEveryList(player);
  await removeEvery(host, BLACK_CARD);
  await removeEvery(host, MEMBER);
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
  // The tab leads with the urgent count (decision 0301).
  await expect(host).toHaveTitle(/^\(\d+\) /, { timeout: 15_000 });
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
    // The join asking: the name, "asks to join", Approve and Decline, each read with the name.
    await expect(higher.getByText('asks to join')).toBeVisible();
    await expect(higher.getByRole('button', { name: `Decline ${MEMBER}` })).toBeVisible();
    await higher.getByRole('button', { name: `Approve ${MEMBER}` }).click();
    await expect(host.getByText(`${MEMBER} added to the Table 2 list`)).toBeVisible();
    await player.reload();
    await expect(player.getByText(IN_LINE)).toBeVisible();
    await expect(player.getByText('Waitlist · Table 2 · NLH 100/200')).toBeVisible();

    await expect(placeRow(higher, MEMBER)).toBeVisible();
    await removeEvery(host, MEMBER);
    await expect(higher.getByText(MEMBER, { exact: false })).toHaveCount(0);

    await player.reload();
    await expect(tableRow(player, 'Table 2')).toBeVisible();
    await expect(player.getByRole('button', { name: 'Leave waitlist' })).toHaveCount(0);

    const lower = gameList(host, 'Table 1');
    await addByNumber(lower, '9000000211');
    await expect(placeRow(lower, MEMBER)).toHaveText(new RegExp(`^1${MEMBER}`));
    await expect(placeRow(lower, MEMBER)).toContainText('added by the floor');
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
    await expect(placeRow(higher, BLACK_CARD)).toHaveText(new RegExp(`^1${BLACK_CARD}.*Black card`));
    // One list at a time (#633): off Table 2's before Table 1's.
    await removeEvery(host, BLACK_CARD);
    await expect(higher.getByText(BLACK_CARD, { exact: false })).toHaveCount(0);
    await addByNumber(lower, '9000000212');
    await expect(placeRow(lower, BLACK_CARD)).toHaveText(new RegExp(`^2${BLACK_CARD}`));
    await expect(placeRow(lower, BLACK_CARD)).not.toContainText('Black card');
    await removeEvery(host, BLACK_CARD);

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
    await higher.getByRole('button', { name: `Seat ${MEMBER}` }).click();
    // A place is seated only at its list's table (decision 0433): the sheet names Table 2.
    const sheet = host.getByRole('dialog', { name: `Seat ${MEMBER}` });
    await expect(sheet.getByText(/^Table 2 · /)).toBeVisible();
    await sheet.getByRole('radiogroup', { name: 'Seat', exact: true }).getByRole('radio', { name: '9', exact: true }).click();
    await sheet.getByRole('radiogroup', { name: 'Call time' }).getByRole('radio', { name: '4 h', exact: true }).click();
    await sheet.getByRole('button', { name: 'Seat', exact: true }).click();
    await expect(host.getByText(`${MEMBER} seated at Table 2, seat 9`)).toBeVisible();
    // Assigned is seated: off the list at once, with no hold to wait out.
    await expect(higher.getByText(MEMBER, { exact: false })).toHaveCount(0);
    await player.reload();
    await expect(player.getByRole('button', { name: 'Leave waitlist' })).toHaveCount(0);
    // Seated, he joins no other game from the app (#633): the tables only show.
    await expect(player.getByRole('heading', { name: 'Table 2 · Seat 9' })).toBeVisible();
    await expect(tableRow(player, 'Table 2')).toHaveCount(0);
  });

  test('Hold place and Release: the floor holds a member\u2019s place and brings it back; the member has no Step away', async () => {
    // Seated from the step before, the member is on a list only as the floor adds him, to change tables (#633): Table 3's.
    await host.reload();
    await addByNumber(gameList(host, 'Table 3'), '9000000211');

    await host.reload();
    const higher = gameList(host, 'Table 3');
    await higher.getByRole('button', { name: `More for ${MEMBER}` }).click();
    await host.getByRole('menuitem', { name: 'Hold place' }).click();
    await expect(placeRow(higher, MEMBER)).toContainText('place held');
    await higher.getByRole('button', { name: `More for ${MEMBER}` }).click();
    await host.getByRole('menuitem', { name: 'Release' }).click();
    await expect(placeRow(higher, MEMBER)).not.toContainText('place held');

    // Only the floor holds a place now (decision 0300): the member's Tonight offers no Step away.
    await player.reload();
    await expect(player.getByRole('heading', { name: 'Table 2 · Seat 9' })).toBeVisible();
    await expect(player.getByRole('button', { name: /^Step away/ })).toHaveCount(0);

    await removeEvery(host, MEMBER);
  });

  test('Bulk bar: the floor ticks two places on a list and holds both, then removes both after a question', async () => {
    await host.reload();
    const list = gameList(host, 'Table 3');
    await addByNumber(list, '9000000211');
    await expect(placeRow(list, MEMBER)).toBeVisible();
    await addByNumber(list, '9000000212');
    await expect(placeRow(list, BLACK_CARD)).toBeVisible();
    await list.getByRole('checkbox', { name: `Select ${MEMBER}` }).check();
    await list.getByRole('checkbox', { name: `Select ${BLACK_CARD}` }).check();
    await host.getByRole('button', { name: 'Hold', exact: true }).click();
    await expect(host.getByText('Places held: 2')).toBeVisible();
    await expect(placeRow(list, MEMBER)).toContainText('place held');
    await expect(placeRow(list, BLACK_CARD)).toContainText('place held');

    await list.getByRole('checkbox', { name: `Select ${MEMBER}` }).check();
    await list.getByRole('checkbox', { name: `Select ${BLACK_CARD}` }).check();
    await host.getByRole('button', { name: 'Remove', exact: true }).click();
    await host.getByRole('button', { name: 'Yes, remove them' }).click();
    await expect(host.getByText('Removed from the lists: 2')).toBeVisible();
    await expect(list.getByText(MEMBER, { exact: false })).toHaveCount(0);
    await expect(list.getByText(BLACK_CARD, { exact: false })).toHaveCount(0);
  });
});
