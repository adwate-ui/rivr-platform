/**
 * Live floor (console v3, phase 2; decision 0479). Meera Chopra, this flow's own floor manager (Auth sends one code a
 * minute to a number), opens the live floor: the active tables room by room, each a tile with its stake and seat bar,
 * Table 4 closed with Open table; Summary or Seats; Needs you; Seat a player, the one gold button; the requests docked
 * beside; a table's ⋯ opens its sheet. No rake and no rupee show (#626, decision 0284).
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { requestsPanel, showSeats, tableTile } from '../support/floor.ts';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Live floor', () => {
  test('the tiles show every active table by room, a closed one with Open table, and a table\'s sheet; no rake or rupee', async ({ page }) => {
    test.skip(isRemoteTarget(), 'reads the seeded floor, so the local stack only');
    await signInToConsole(page, '9000000129');
    await expect(page.getByRole('heading', { name: 'Live floor', level: 1 })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Main room' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Private Room' })).toBeVisible();
    for (const name of ['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5', 'Private Room']) await expect(tableTile(page, name)).toBeVisible();
    await expect(tableTile(page, 'Table 4').getByText('Closed', { exact: true })).toBeVisible();
    await expect(tableTile(page, 'Table 4').getByRole('button', { name: 'Open table' })).toBeVisible();
    await expect(requestsPanel(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Seat a player' })).toHaveAttribute('aria-keyshortcuts', 'S');

    // Seats lists every seat of an open table; a closed one has none to list.
    await showSeats(page);
    await expect(tableTile(page, 'Table 5').getByRole('button', { name: /^Seat 9, / })).toBeVisible();
    await expect(tableTile(page, 'Table 4').getByRole('button', { name: /^Seat 1, / })).toHaveCount(0);

    // The table's sheet: its status, seated, dealer and waiting, and Open or Close for tonight.
    await page.getByRole('button', { name: 'Settings for Table 5', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Table 5' });
    await expect(sheet.getByText('Status', { exact: true })).toBeVisible();
    await expect(sheet.getByText('Waiting', { exact: true })).toBeVisible();
    await expect(sheet.getByRole('radiogroup', { name: 'Must move to' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText(/₹|[Rr]ake/)).toHaveCount(0);
  });
});
