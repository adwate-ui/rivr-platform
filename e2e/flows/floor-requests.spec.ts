/**
 * The floor's requests (console v3, phase 2; decisions 0446 to 0448). Devika Rana, this flow's own floor manager (Auth
 * sends one code a minute to a number), works the requests docked beside the Live floor, oldest first. Neel Bose and
 * Devansh Malik ask to join Table 1 from the app: A approves the oldest, D declines the next, which Undo brings back, and
 * Decline declines it again. Seated, Devansh asks for an hour, which she declines, and says he is leaving: Not leaving,
 * undone, then Leave with a reason. Karan Gill, a host, frees Neel's seat owing call time, and she records why he was let
 * go. Approving more time and a top-up are in the Call time flow.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { openPlayer, requestsPanel, seatOnFloor } from '../support/floor.ts';
import { signInToConsole, signInToPlayer } from '../support/signIn.ts';

/** A member's request in the panel that says `kind`: its own entry, once it has arrived. */
async function requestOf(floor: Page, name: string, kind: RegExp) {
  const entry = requestsPanel(floor).locator('div').filter({ has: floor.getByRole('button', { name, exact: true }) }).filter({ hasText: kind }).last();
  await expect(entry).toBeVisible({ timeout: 20_000 });
  return entry;
}

/** The member asks to join Table 1 from Tonight's tables, and the sheet closes. */
async function askToJoin(member: Page) {
  await member.getByRole('button', { name: /^Table 1 · / }).click();
  const sheet = member.getByRole('dialog');
  await sheet.getByRole('button', { name: /^(Take a seat|Join waitlist)$/ }).click();
  await expect(sheet).toHaveCount(0);
}

test.describe('Floor requests', () => {
  test('the floor approves and declines each kind of request, oldest first, by key and by button, with Undo', async ({ page, browser }) => {
    test.skip(isRemoteTarget(), 'seats members and lets them go, so the local stack only');
    test.setTimeout(150_000);
    await signInToConsole(page, '9000000138');
    await expect(page.getByRole('heading', { name: 'Live floor', level: 1 })).toBeVisible();
    const neel = await browser.newPage();
    await signInToPlayer(neel, '9000000217');
    const devansh = await browser.newPage();
    await signInToPlayer(devansh, '9000000296');

    // Joins from the app: A approves the oldest, D declines the next, Undo brings it back, Decline declines it again.
    await askToJoin(neel);
    await askToJoin(devansh);
    await requestOf(page, 'Neel Bose', /Join request/);
    await requestOf(page, 'Devansh Malik', /Join request/);
    await page.keyboard.press('a');
    await expect(page.getByText('Neel Bose added to the Table 1 list')).toBeVisible();
    await expect(requestsPanel(page).getByRole('button', { name: 'Neel Bose', exact: true })).toHaveCount(0);
    await page.keyboard.press('d');
    await expect(page.getByText('Devansh Malik: join declined')).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Undone', { exact: true })).toBeVisible();
    await (await requestOf(page, 'Devansh Malik', /Join request/)).getByRole('button', { name: 'Decline' }).click();
    await expect(page.getByText('Devansh Malik: join declined')).toBeVisible();

    // Seated, Devansh asks for an hour: declined.
    await seatOnFloor(page, { table: 'Table 1', seat: 9, number: '9000000296' });
    await devansh.reload();
    await devansh.getByRole('button', { name: 'Add time' }).click();
    await devansh.getByRole('dialog', { name: 'Add time' }).getByRole('button', { name: 'Request 1 hour' }).click();
    await (await requestOf(page, 'Devansh Malik', /Wants \+1 h/)).getByRole('button', { name: 'Decline' }).click();
    await expect(page.getByText('Devansh Malik: time request declined')).toBeVisible();

    // He says he is leaving: Not leaving, undone; then Leave, owing, with a reason kept on his record.
    await devansh.reload();
    await devansh.getByRole('button', { name: 'Leave seat' }).click();
    await devansh.getByRole('dialog', { name: 'Leave your seat?' }).getByRole('button', { name: 'Join leaving list' }).click();
    await (await requestOf(page, 'Devansh Malik', /^Leaving/)).getByRole('button', { name: 'Not leaving' }).click();
    await expect(page.getByText('Devansh Malik is staying')).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Undone', { exact: true })).toBeVisible();
    await (await requestOf(page, 'Devansh Malik', /^Leaving/)).getByRole('button', { name: 'Leave', exact: true }).click();
    const leave = page.getByRole('dialog', { name: 'Let go before call time' });
    await leave.getByRole('radio', { name: 'Table broke' }).click();
    await leave.getByRole('button', { name: 'Let go early' }).click();
    await expect(page.getByText('Devansh Malik let go early')).toBeVisible();

    // A host seats Neel (which takes him off the list) and frees his seat owing; the floor records why he was let go.
    const host = await browser.newPage();
    await signInToConsole(host, '9000000108');
    await seatOnFloor(host, { table: 'Table 1', seat: 8, number: '9000000217' });
    const sheet = await openPlayer(host, 'Neel Bose');
    await sheet.getByRole('button', { name: 'Leave', exact: true }).last().click();
    await host.getByRole('dialog', { name: 'Let go before call time' }).getByRole('button', { name: 'Leave owing' }).click();
    await expect(host.getByText('Neel Bose left Table 1')).toBeVisible();
    await (await requestOf(page, 'Neel Bose', /Left before call time/)).getByRole('button', { name: 'Record' }).click();
    const record = page.getByRole('dialog', { name: 'Let go before call time' });
    await record.getByRole('radio', { name: 'Unwell' }).click();
    await record.getByRole('button', { name: 'Let go early' }).click();
    await expect(page.getByText('Neel Bose let go early')).toBeVisible();
    await expect(requestsPanel(page).getByRole('button', { name: 'Neel Bose', exact: true })).toHaveCount(0, { timeout: 15_000 });
  });
});
