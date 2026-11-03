/**
 * Seating (#77; console v3, phase 2). Kiran Bhat, this flow's own floor manager (Auth sends one code a minute to a
 * number), seats Ishaan Verma at Table 5, seat 1 by his mobile number from the seat's own row. She moves him to another
 * table, the table first and then a seat, and takes the move back with Undo. He leaves before his call time is met: Leave
 * asks one of four reasons (decision 0481), kept on his record, and frees the seat. Empty, Table 5 closes for tonight
 * from its sheet, and Undo opens it again.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { letGoEarly, openPlayer, seatOnFloor, tableTile } from '../support/floor.ts';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Seating', () => {
  test('the floor seats a player, moves them table then seat, lets them go early with a reason; an empty table closes', async ({ page }) => {
    test.skip(isRemoteTarget(), 'seats a member and closes a table, so the local stack only');
    await signInToConsole(page, '9000000125');
    await expect(page.getByRole('heading', { name: 'Live floor', level: 1 })).toBeVisible();
    await seatOnFloor(page, { table: 'Table 5', seat: 1, number: '9000000211' });
    await expect(tableTile(page, 'Table 5').getByRole('button', { name: /^Seat 1, Ishaan Verma, / })).toBeVisible();

    // Move: the table first, then one of its open seats; Undo moves him back.
    const player = await openPlayer(page, 'Ishaan Verma');
    await player.getByRole('radio', { name: /^Table 3 · \d+ open$/ }).click();
    const seat = player.getByRole('radiogroup', { name: 'Seat' }).getByRole('radio').first();
    const number = (await seat.textContent()) ?? '';
    await seat.click();
    await expect(page.getByText(`Ishaan Verma moved to Table 3, seat ${number}`)).toBeVisible();
    // The sheet holds the screen while open: Undo is the toast's, below it.
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Undone', { exact: true })).toBeVisible();
    await expect(tableTile(page, 'Table 5').getByRole('button', { name: /^Seat 1, Ishaan Verma, / })).toBeVisible();

    // He leaves before Table 5's call time: a reason, and the seat is freed.
    await letGoEarly(page, 'Ishaan Verma', 'Unwell');
    await expect(tableTile(page, 'Table 5').getByRole('button', { name: 'Seat 1, Open' })).toBeVisible();

    // Empty, Table 5 closes for tonight; Undo opens it again.
    await page.getByRole('button', { name: 'Settings for Table 5' }).click();
    await page.getByRole('dialog', { name: 'Table 5' }).getByRole('button', { name: 'Close table for tonight' }).click();
    await expect(page.getByText('Table 5 closed', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Undone', { exact: true })).toBeVisible();
    await expect(tableTile(page, 'Table 5').getByText('Closed', { exact: true })).toHaveCount(0);
  });
});
