/** The Live floor as console v3 draws it (decision 0479): a table's tile, seating by number, a player's sheet, letting go. */
import { expect, type Page } from '@playwright/test';

/** A table's tile, named for the table and its stake: "Table 5 100/200". */
export const tableTile = (page: Page, table: string) => page.getByRole('group', { name: new RegExp(`^${table} \\d`) });

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
  await sheet.getByRole('textbox', { name: 'Or a mobile or member number' }).fill(number);
  await sheet.getByRole('button', { name: 'Seat', exact: true }).click();
  await expect(page.getByText(`${number} seated at ${table}, seat ${String(seat)}`)).toBeVisible();
}

/** Opens a seated player's sheet from their row. */
export async function openPlayer(page: Page, name: string) {
  await showSeats(page);
  await page.getByRole('button', { name: new RegExp(`^Seat \\d+, ${name},`) }).click();
  return page.getByRole('dialog', { name });
}

/** Lets a seated player owing call time go early from their sheet's Leave, with one of the four reasons (decision 0481). */
export async function letGoEarly(page: Page, name: string, reason = 'Emergency') {
  const sheet = await openPlayer(page, name);
  await sheet.getByRole('button', { name: 'Leave', exact: true }).last().click();
  const leave = page.getByRole('dialog', { name: 'Let go before call time' });
  await leave.getByRole('radio', { name: reason }).click();
  await leave.getByRole('button', { name: 'Let go early' }).click();
  await expect(page.getByText(`${name} let go early`)).toBeVisible();
}
