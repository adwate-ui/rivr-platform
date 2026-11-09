/**
 * Members (#60; design prompt console rail "Members"). Sunita Rao, this flow's own membership manager
 * (Auth sends one code a minute to a number), sees every member listed on open (decision 0483), narrows
 * the list to Arjun Mehta by name and opens his record: a black
 * card qualifying at 100/200, his visits and early departures. She finds Kabir Sethi by mobile number
 * and moves him to Founders' Circle for the weekend, with a reason; his record shows the tier and its
 * last day. She puts him back for good at the end, so the next run finds him a member. The sweep that
 * ends a change on its day, and who may change a tier, are proved in supabase/tests/058_member_record.test.sql.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

test.describe('Members', () => {
  test('a membership manager finds a member, opens the record and changes a tier with a reason', async ({ page }) => {
    test.skip(isRemoteTarget(), 'changes a member\'s tier, so the local stack only');
    await signInToConsole(page, '9000000133');
    await page.getByRole('link', { name: 'Members' }).click();
    await expect(page.getByRole('heading', { name: 'Members', level: 1 })).toBeVisible();

    // Every member is listed on open, with no prompt to search first (decision 0483); the search narrows the list.
    const table = page.getByRole('table', { name: 'Members' });
    await expect(table.getByRole('row').nth(1)).toBeVisible();
    await expect(page.getByText(/^Search by member number/)).toHaveCount(0);
    const search = page.getByRole('searchbox', { name: 'Name, mobile or member number' });
    await search.fill('Arjun');
    await expect(table.getByRole('button', { name: 'Kabir Sethi', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Arjun Mehta', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Arjun Mehta', level: 2 })).toBeVisible();
    // The record is in the address (console v3), so Back and the floor's links open it.
    await expect(page).toHaveURL(/\/members\?member=/);
    // The list stays where it was as the record opens beside it, so the search typed is still there (C-02).
    await expect(search).toHaveValue('Arjun');
    await expect(page.getByText(/^No\. \d+ · Black card tier · ID checked/)).toBeVisible();
    await expect(page.getByText('Qualifies at 100/200')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Early departures' })).toBeVisible();
    // A membership manager sets a break from the record (A5-14); setting one is proved in 046_member_breaks.test.sql.
    // The record's parts are tabs (C-02).
    await page.getByRole('link', { name: 'Tier and break' }).click();
    await expect(page.getByRole('heading', { name: 'Break', level: 3 })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'How long' }).getByRole('radio', { name: '1 year' })).toBeVisible();
    // Feature overrides, the number and erasure, the Account part, are for super admins alone (#61).
    await expect(page.getByRole('link', { name: 'Account', exact: true })).toHaveCount(0);

    await search.fill('9000000202');
    await page.getByRole('button', { name: 'Kabir Sethi', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Kabir Sethi', level: 2 })).toBeVisible();
    await page.getByRole('link', { name: 'Tier and break' }).click();
    await page.getByRole('radiogroup', { name: 'New tier' }).getByRole('radio', { name: "Founders' Circle" }).click();
    await page.getByRole('textbox', { name: 'Why', exact: true }).fill("Owner's guest for the weekend");
    const lastDay = new Date(Date.now() + 2 * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    await page.getByLabel('Last day (optional)').fill(lastDay);
    await page.getByRole('button', { name: 'Change tier', exact: true }).click();
    await expect(page.getByText('Tier changed.')).toBeVisible();
    await expect(page.getByText(/^No\. \d+ · Founders' Circle until \d{1,2} \w{3} \d{4}/)).toBeVisible();

    await page.getByRole('radiogroup', { name: 'New tier' }).getByRole('radio', { name: 'Member', exact: true }).click();
    await page.getByRole('textbox', { name: 'Why', exact: true }).fill('Back after the weekend');
    await page.getByRole('button', { name: 'Change tier', exact: true }).click();
    await expect(page.getByText(/^No\. \d+ · Member tier · /)).toBeVisible();
  });
});
