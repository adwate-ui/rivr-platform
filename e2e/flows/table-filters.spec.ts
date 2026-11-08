/**
 * Table filters (owner, 9 Nov: every column filtered by its type from its header, the filters as pills, kept in the
 * address). Dev Arora, a super admin signing in with this flow's own number, filters Members by KYC and by visits from
 * the column menus, sees the filters as pills with how many members show, and opens a record: the list beside it keeps
 * every column and its filters. A reload, Back and the address opened in a new tab show the same list.
 */
import { expect, test, type Page } from '@playwright/test';
import { signInToConsole } from '../support/signIn.ts';

/** Opens a column's menu from the Members table's header and gives its dialog. */
async function menuOf(page: Page, column: string) {
  await page.getByRole('button', { name: new RegExp(`^${column}: sort and filter`) }).click();
  return page.getByRole('dialog', { name: `${column}: sort and filter` });
}

/** The pills for the two filters, and how many members show of all. */
async function expectFiltered(page: Page) {
  await expect(page.getByRole('button', { name: 'Remove filter ID check: Checked' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove filter Visits: at least 1' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: / of / })).toHaveText(/^\d+ of \d+$/);
}

test.describe('table filters', () => {
  test('filters Members from the column menus, as pills, kept in the address through a record, a reload, Back and a link', async ({ page, context }) => {
    await signInToConsole(page, '9000000181', '/members');
    const table = page.getByRole('table', { name: 'Members' });
    await expect(table.getByRole('row').nth(1)).toBeVisible();

    const kyc = await menuOf(page, 'ID check');
    await kyc.getByRole('group', { name: 'ID check' }).getByRole('button', { name: /^Checked/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'ID check: sort and filter, filtered' })).toBeFocused();
    const visits = await menuOf(page, 'Visits');
    await visits.getByRole('textbox', { name: 'From' }).fill('1');
    await page.keyboard.press('Escape');
    await expectFiltered(page);
    await expect(page).toHaveURL(/t\.members=/);

    // A record opens beside the list, which keeps every column and its filters (owner, 9 Nov).
    await table.getByRole('row').nth(1).getByRole('button').first().click();
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(page).toHaveURL(/member=.*t\.members=|t\.members=.*member=/);
    for (const column of [/^ID check/, /^City/, /^Hours played/, /^Mobile/]) await expect(table.getByRole('columnheader', { name: column })).toHaveCount(1);
    await expectFiltered(page);

    await page.reload();
    await expectFiltered(page);
    await page.goBack();
    await expect(page).not.toHaveURL(/member=/);
    await expectFiltered(page);

    const shared = await context.newPage();
    await shared.goto(page.url());
    await expectFiltered(shared);
  });
});
