/**
 * Markers (#74; additions flow 19; the prototype's Cage and Markers). Lakshmi Iyer, this flow's own
 * duty manager (Auth sends one code a minute to a number), seats Neel Bose at Table 2, seat 7, gives
 * him ₹50,000 of credit, and at the cage issues ₹50,000 on a marker he signs on the pad; ₹10,000 more
 * is refused, above his limit. The Markers screen shows his marker outstanding, with its age, beside
 * Arjun Mehta's (seed). Then design prompt flow 8 (#75) at its own figures, with Neel, who is in the
 * room and has finished his identity check: he cashes out ₹1,20,000 of chips; his ₹50,000 marker
 * settles first, ₹70,000 goes to his wallet, and the room's exposure drops by ₹50,000. He leaves the table at the end. Past due, the room's cap and freezes are proved in
 * supabase/tests/054_markers.test.sql; a cash-out's ledger lines in 055_cash_out.test.sql.
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

/** Signs on the pad, scrolled into view, with one stroke of the mouse; the pad's Clear turns on once the stroke is kept. */
async function sign(page: Page, label: string) {
  const pad = page.getByRole('img', { name: label });
  await pad.scrollIntoViewIfNeeded();
  const box = await pad.boundingBox();
  if (box === null) throw new Error('The signature pad is not on screen');
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 3, box.y + 20, { steps: 5 });
  await page.mouse.move(box.x + (box.width * 2) / 3, box.y + box.height - 20, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Clear' })).toBeEnabled();
}

/** The room's exposure in whole rupees, from the Markers screen's `₹60,000 of ₹25,00,000`. */
function rupees(text: string | null): number {
  return Number((text ?? '').split(' of ')[0]?.replace(/[₹,]/g, ''));
}

test.describe('Markers', () => {
  test('Marker and cash-out: a cashier issues a signed marker within the limit and refuses one above it; a cash-out settles markers first', async ({ page }) => {
    test.skip(isRemoteTarget(), 'seats a member, gives credit and issues a marker, so the local stack only');
    await signInToConsole(page, '9000000131');
    await page.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Table 2', exact: true }).click();
    await page.getByRole('group', { name: 'Seat', exact: true }).getByRole('button', { name: '7', exact: true }).click();
    await page.getByRole('textbox', { name: 'Mobile number' }).fill('9000000217');
    await page.getByRole('button', { name: 'Seat', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Move Neel Bose' })).toBeVisible();

    await page.getByRole('link', { name: 'Markers' }).click();
    await page.getByRole('textbox', { name: 'Mobile number' }).fill('9000000217');
    await page.getByRole('textbox', { name: 'Limit' }).fill('50000');
    await page.getByRole('textbox', { name: 'Why' }).fill('A regular');
    await page.getByRole('button', { name: 'Set limit' }).click();
    await expect(page.getByText('Limit in force.')).toBeVisible();

    await page.getByRole('link', { name: 'Cage' }).click();
    await page.getByRole('textbox', { name: 'Search members' }).fill('Neel');
    await page.getByRole('button', { name: 'Neel Bose' }).click();
    const amount = page.getByRole('textbox', { name: 'Marker amount' });
    await amount.fill('50000');
    await sign(page, 'Signature of Neel Bose for ₹50,000');
    await page.getByRole('button', { name: 'Issue marker' }).click();
    await expect(page.getByText('₹50,000 issued on a marker.')).toBeVisible();
    // A signature is for one amount: a new amount is signed again.
    await amount.fill('10000');
    await sign(page, 'Signature of Neel Bose for ₹10,000');
    await page.getByRole('button', { name: 'Issue marker' }).click();
    await expect(page.getByText('That takes this member above their credit limit.')).toBeVisible();

    await page.getByRole('link', { name: 'Markers' }).click();
    await expect(page.getByRole('heading', { name: 'Outstanding' })).toBeVisible();
    await expect(page.getByText('Neel Bose', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Marker of ₹50,000 · limit ₹50,000').first()).toBeVisible();
    await expect(page.getByText('Arjun Mehta', { exact: true }).first()).toBeVisible();

    // Flow 8: Neel hands back ₹1,20,000 of chips. His ₹50,000 marker settles first and ₹70,000 goes
    // to his wallet; the room's exposure drops by ₹50,000.
    const exposure = page.getByText(/^₹[\d,]+ of ₹[\d,]+$/);
    const before = rupees(await exposure.textContent());
    // He still owes call time at Table 2 (#79), so the duty manager lets him go first.
    await page.getByRole('link', { name: 'Live floor' }).click();
    await page.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Table 2', exact: true }).click();
    await page.getByRole('button', { name: 'Let Neel Bose leave early' }).click();
    await page.getByRole('textbox', { name: 'Why they leave early' }).fill('Settling his marker');
    await page.getByRole('button', { name: 'Let leave early' }).click();
    await expect(page.getByText('Early departure recorded. The cage can cash them out.')).toBeVisible();
    await page.getByRole('link', { name: 'Cage' }).click();
    await page.getByRole('textbox', { name: 'Search members' }).fill('Neel');
    await page.getByRole('button', { name: 'Neel Bose' }).click();
    await page.getByRole('group', { name: 'Pay to' }).getByRole('button', { name: 'Wallet' }).click();
    await page.getByRole('textbox', { name: 'Chips handed back' }).fill('120000');
    await expect(page.getByText('Settles markers')).toBeVisible();
    await expect(page.getByText('To the wallet')).toBeVisible();
    await page.getByRole('button', { name: 'Cash out' }).click();
    await expect(page.getByText('Cash-out done. ₹70,000 to the wallet.')).toBeVisible();
    await expect(page.getByText('Markers settled: ₹50,000.')).toBeVisible();
    // Its receipt (#69) says what the cash-out settled; the printer dialog is the browser's own, so it is left out.
    await page.evaluate(() => { globalThis.print = () => undefined; });
    await page.getByRole('button', { name: 'Print receipt' }).click();
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByText('Markers settled', { exact: true })).toBeVisible();
    await expect(page.getByText(/^Receipt [0-9A-F]{8}$/)).toBeVisible();
    await page.emulateMedia({ media: 'screen' });
    await page.getByRole('link', { name: 'Markers' }).click();
    await expect(page.getByText('Arjun Mehta', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Marker of ₹50,000 · limit ₹50,000')).toHaveCount(0);
    await expect.poll(async () => rupees(await exposure.textContent())).toBe(before - 50_000);

    await page.getByRole('link', { name: 'Live floor' }).click();
    await page.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Table 2', exact: true }).click();
    await page.getByRole('button', { name: 'Neel Bose leaves' }).click();
    await expect(page.getByRole('button', { name: 'Move Neel Bose' })).toHaveCount(0);
  });
});
