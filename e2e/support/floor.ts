/** The Live floor as console v3 draws it (decision 0479): a table's tile, seating by number, a player's sheet, letting go. */
import { expect, type Page } from '@playwright/test';

/** A table's tile, named for the table and its stake: "Table 5 NLH 100/200". */
export const tableTile = (page: Page, table: string) => page.getByRole('group', { name: new RegExp(`^${table} [A-Z]+ \\d`) });

/** The requests docked beside the floor. */
export const requestsPanel = (page: Page) => page.getByRole('complementary', { name: 'Requests' });

/** Every tile shows its seats. */
export async function showSeats(page: Page) {
  await page.getByRole('radiogroup', { name: 'View' }).getByRole('radio', { name: 'Seats' }).click();
}

/** Seats a member by mobile or member number in an open seat, from that seat's row, and waits for the toast. */
export async function seatOnFloor(page: Page, { table, seat, number }: { table: string; seat: number; number: string }) {
  await showSeats(page);
  await tableTile(page, table).getByRole('button', { name: `Seat ${String(seat)}, Open` }).click();
  const sheet = page.getByRole('dialog', { name: 'Seat a player' });
  await sheet.getByRole('textbox', { name: /^(Or a n|N)ame, mobile or member number$/ }).fill(number);
  await sheet.getByRole('button', { name: 'Seat', exact: true }).click();
  await expect(page.getByText(`${number} seated at ${table}, seat ${String(seat)}`)).toBeVisible();
}

/**
 * Opens a seated player's sheet from their row's own button, by Enter: the name in the row is a link to their account on
 * Members (the owner, 19 Nov), so a press on the name opens Members, not the seat; the key needs no row geometry.
 */
export async function openPlayer(page: Page, name: string) {
  await showSeats(page);
  await page.getByRole('button', { name: new RegExp(`^Seat \\d+, ${name},`) }).press('Enter');
  return page.getByRole('dialog', { name });
}

/**
 * A member's request in the floor's panel: the card whose own button names them, "Join request, Neel Bose, Table 1 waitlist"
 * (UI review of the batch PR). The button covers the card, so the card is the box that holds it, actions and all.
 */
export const requestNamed = (page: Page, name: string) =>
  requestsPanel(page).locator('div').filter({ has: page.getByRole('button', { name: new RegExp(`(^|, )${name}(,|$)`) }) });

/**
 * Lets a seated player owing call time go early from their sheet's Leave, with a reason (decisions 0481, 0680); with
 * `isCheckingOut`, the same and checked out of the club.
 */
export async function letGoEarly(page: Page, name: string, reason = 'Emergency', isCheckingOut = false) {
  const sheet = await openPlayer(page, name);
  await sheet.getByRole('button', { name: 'Leave', exact: true }).last().click();
  const leave = page.getByRole('dialog', { name: 'Let go before call time' });
  await leave.getByRole('radio', { name: reason }).click();
  await leave.getByRole('button', { name: isCheckingOut ? 'Let go early and check out' : 'Let go early', exact: true }).click();
  await expect(page.getByText(isCheckingOut ? `${name} let go early and checked out` : `${name} let go early`, { exact: true })).toBeVisible();
}
