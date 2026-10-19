/**
 * Seating (#77; scope-v1 module 2; the prototype's live floor). Kiran Bhat, this flow's own floor
 * manager (Auth sends one code a minute to a number), seats Ishaan Verma at Table 5, seat 1 by his
 * mobile number: Table 5's ring shows him and its count reads 1 of 9. She moves him to seat 2, the
 * same session so his call time runs on, and he leaves before it is complete: he is listed as left
 * before call time until she lets him leave early (#79). Empty, Table 5 closes and opens again.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Seating', () => {
  test('the floor seats, moves and lets a player leave; an empty table closes', async ({ page }) => {
    test.skip(isRemoteTarget(), 'seats a member and closes a table, so the local stack only');
    await signInToConsole(page, '9000000125');
    await expect(page.getByRole('heading', { name: 'Live floor', level: 1 })).toBeVisible();
    await page.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Table 5', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Table 5', level: 2 })).toBeVisible();

    await page.getByRole('group', { name: 'Seat', exact: true }).getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('textbox', { name: 'Mobile number' }).fill('9000000211');
    await page.getByRole('button', { name: 'Seat', exact: true }).click();
    await expect(page.getByRole('img', { name: 'Table 5, 1 of 9 seats taken' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close table' })).toBeDisabled();

    await page.getByRole('button', { name: 'Move Ishaan Verma' }).click();
    await page.getByRole('group', { name: 'Table' }).last().getByRole('button', { name: 'Table 5', exact: true }).click();
    await page.getByRole('group', { name: 'Seat', exact: true }).first().getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: 'Move', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Move Ishaan Verma' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Move Ishaan Verma' })).toBeVisible();

    await page.getByRole('button', { name: 'Ishaan Verma leaves' }).click();
    await expect(page.getByRole('img', { name: 'Table 5, 0 of 9 seats taken' })).toBeVisible();
    // He left before Table 5's call time (#79): she lets him leave early, so the cage can cash him out.
    await expect(page.getByRole('heading', { name: 'Left before call time' })).toBeVisible();
    await page.getByRole('button', { name: 'Let Ishaan Verma leave early' }).click();
    await page.getByRole('textbox', { name: 'Why they leave early' }).fill('Called away');
    await page.getByRole('button', { name: 'Let leave early' }).click();
    await expect(page.getByText('Early departure recorded. The cage can cash them out.')).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Let Ishaan Verma leave early' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Close table' }).click();
    await expect(page.getByRole('img', { name: 'Table 5, closed' })).toBeVisible();
    await page.getByRole('button', { name: 'Open table' }).click();
    await expect(page.getByRole('img', { name: 'Table 5, 0 of 9 seats taken' })).toBeVisible();
  });
});
