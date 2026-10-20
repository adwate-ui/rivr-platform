/**
 * Members (#60; design prompt console rail "Members"). Sunita Rao, this flow's own membership manager
 * (Auth sends one code a minute to a number), finds Arjun Mehta by name and opens his record: a black
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

    const search = page.getByRole('searchbox', { name: 'Find a member' });
    await search.fill('Arjun');
    await page.getByRole('button', { name: 'Open Arjun Mehta' }).click();
    await expect(page.getByRole('heading', { name: 'Arjun Mehta', level: 2 })).toBeVisible();
    await expect(page.getByText(/^Member \d+ · Black card · KYC verified/)).toBeVisible();
    await expect(page.getByText('Qualifies at 100/200')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Early departures' })).toBeVisible();
    // Feature overrides are for super admins alone (#61).
    await expect(page.getByRole('heading', { name: 'Feature overrides' })).toHaveCount(0);

    await search.fill('9000000202');
    await page.getByRole('button', { name: 'Open Kabir Sethi' }).click();
    await expect(page.getByRole('heading', { name: 'Kabir Sethi', level: 2 })).toBeVisible();
    await page.getByRole('group', { name: 'New tier' }).getByRole('button', { name: "Founders' Circle" }).click();
    await page.getByRole('textbox', { name: 'Why' }).fill("Owner's guest for the weekend");
    const lastDay = new Date(Date.now() + 2 * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    await page.getByLabel('Last day (optional)').fill(lastDay);
    await page.getByRole('button', { name: 'Change tier', exact: true }).click();
    await expect(page.getByText('Tier changed.')).toBeVisible();
    await expect(page.getByText(/^Member \d+ · Founders' Circle until \d{1,2} \w{3} \d{4}/)).toBeVisible();

    await page.getByRole('group', { name: 'New tier' }).getByRole('button', { name: 'Member', exact: true }).click();
    await page.getByRole('textbox', { name: 'Why' }).fill('Back after the weekend');
    await page.getByRole('button', { name: 'Change tier', exact: true }).click();
    await expect(page.getByText(/^Member \d+ · Member · /)).toBeVisible();
  });
});
