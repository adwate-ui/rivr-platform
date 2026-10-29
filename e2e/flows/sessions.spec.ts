/**
 * Sessions (#127, #627; design prompt, "Sessions"). Sahil Arora, this flow's own duty manager (Auth sends one code a
 * minute to a number), seats Rhea Kaul at Table 2, seat 4, lets her go before her call time and checks her out at the
 * door, which closes her visit. On her phone, her history shows this month with the session: when, the table and how
 * long, with no money. She hides it from her list, and it is gone from it; the club keeps the visit. The month's
 * totals, the tier gate and that hiding is hers alone are proved in supabase/tests/157_my_sessions.test.sql.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

test.describe('Sessions', () => {
  test('a member reads a session in her history by month, with no money, and hides it from her list', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'seats a member and closes her visit, so the local stack only');
    test.setTimeout(120_000);
    const sahil = await browser.newPage();
    await signInToConsole(sahil, '9000000613');
    await sahil.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Table 2', exact: true }).click();
    await sahil.getByRole('group', { name: 'Seat', exact: true }).getByRole('button', { name: '4', exact: true }).click();
    await sahil.getByRole('textbox', { name: 'Mobile number' }).fill('9000000297');
    await sahil.getByRole('button', { name: 'Seat', exact: true }).click();
    await expect(sahil.getByRole('button', { name: 'Move Rhea Kaul' })).toBeVisible();

    await sahil.getByRole('button', { name: 'Let Rhea Kaul leave early' }).click();
    await sahil.getByRole('textbox', { name: 'Why they leave early' }).fill('Going home');
    await sahil.getByRole('button', { name: 'Let leave early' }).click();
    await expect(sahil.getByText('Early departure recorded. They can leave their seat.')).toBeVisible();
    await sahil.getByRole('button', { name: 'Rhea Kaul leaves' }).click();
    await expect(sahil.getByRole('button', { name: 'Move Rhea Kaul' })).toHaveCount(0);
    await sahil.getByRole('link', { name: 'Check-in' }).click();
    await sahil.getByRole('textbox', { name: 'Mobile number' }).fill('9000000297');
    await sahil.getByRole('button', { name: 'Check out', exact: true }).click();
    await expect(sahil.getByText('Checked out. Their hours and points are counted.')).toBeVisible();

    const rhea = await browser.newPage();
    await signInToPlayer(rhea, '9000000297', '/sessions');
    await expect(rhea.getByRole('heading', { name: 'Sessions' })).toBeVisible();
    await expect(rhea.getByText(/^1 session · /)).toBeVisible();
    await expect(rhea.getByText(/₹/)).toHaveCount(0);
    const row = rhea.getByRole('button', { name: /Table 2/ });
    await expect(row).toContainText(/\d+ min/);
    await row.click();
    await expect(rhea).toHaveURL(/\/sessions\/[0-9a-f-]{36}$/);
    await expect(rhea.getByRole('heading', { name: 'Table 2' })).toBeVisible();
    await expect(rhea.getByText(/^\d{2}:\d{2} to \d{2}:\d{2}$/)).toBeVisible();
    await expect(rhea.getByText(/₹|Receipt|TDS/)).toHaveCount(0);
    // Hidden, the session is gone from her list, so a run again locally starts from none.
    await rhea.getByRole('button', { name: 'Hide from my sessions' }).click();
    await expect(rhea).toHaveURL(/\/sessions$/);
    await expect(rhea.getByRole('button', { name: /Table 2/ })).toHaveCount(0);
  });
});
