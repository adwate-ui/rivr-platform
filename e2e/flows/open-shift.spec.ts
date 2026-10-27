/**
 * Cage shift (#376; the owner's answer to #367): the cage takes no money while no shift is open. In the
 * practice venue, after End of day has closed its shift, Gauri Sehgal, this flow's floor manager, seats
 * Ishita Bhalla. Zubin Mistry, its cashier, is refused her buy-in at the cage, which says a shift must be
 * opened first; he opens one on Treasury, and the buy-in goes through. The file sorts after
 * end-of-day.spec.ts, which closes the practice cage's shift, and before paper-fallback.spec.ts, which
 * uses the one this flow leaves open; a local rerun needs `pnpm db:reset`. That every cage move is refused without a shift, and the opening against the last
 * close, are proved in supabase/tests/083.
 * It shares the practice cage's one shift with end-of-day.spec.ts and paper-fallback.spec.ts: the three carry the
 * @practice-cage tag, and CI runs them together, in that order, on one runner (decision 0243).
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const CHIPS: Record<string, string> = { '₹50': '100', '₹100': '100', '₹500': '20', '₹1,000': '10', '₹5,000': '4', '₹25,000': '0' };
const NO_SHIFT = 'No shift is open, so the cage takes and pays nothing. A cashier opens one on Treasury.';

async function signInToPractice(page: Page, number: string) {
  await signInToConsole(page, number);
  const rail = page.getByRole('complementary');
  await rail.getByRole('switch', { name: 'Practice venue' }).click();
  await expect(rail.getByText('RIVR Practice')).toBeVisible();
}

/** Finds Ishita at the cage and asks for ₹5,000 of chips for cash. */
async function buyIn(page: Page) {
  await page.getByRole('link', { name: 'Cage' }).click();
  await page.getByRole('textbox', { name: 'Search members' }).fill('Ishita');
  await page.getByRole('button', { name: 'Ishita Bhalla' }).click();
  await expect(page.getByText(/KYC verified · Table 1, seat 3$/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Amount', exact: true }).fill('5000');
  await page.getByRole('button', { name: 'Issue chips' }).click();
}

test.describe('Cage shift', { tag: '@practice-cage' }, () => {
  test('Cage shift: with no shift open the cage refuses a cashier\'s buy-in; once the cashier opens one, it goes through', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'opens the practice cage\'s shift, so the local stack only');
    test.setTimeout(120_000);
    const floor = await browser.newPage();
    await signInToPractice(floor, '9000000157');
    await floor.getByRole('region', { name: 'Room plan' }).getByRole('button', { name: 'Table 1', exact: true }).click();
    await floor.getByRole('group', { name: 'Seat', exact: true }).getByRole('button', { name: '3', exact: true }).click();
    await floor.getByRole('textbox', { name: 'Mobile number' }).fill('9000000252');
    await floor.getByRole('button', { name: 'Seat', exact: true }).click();
    await expect(floor.getByRole('button', { name: 'Move Ishita Bhalla' })).toBeVisible();

    const cashier = await browser.newPage();
    await signInToPractice(cashier, '9000000156');
    await buyIn(cashier);
    await expect(cashier.getByText(NO_SHIFT)).toBeVisible();
    await expect(cashier.getByText('The cage has no shift open. Open one on Treasury with the float and the chips, then try again.')).toBeVisible();

    await cashier.getByRole('link', { name: 'Treasury' }).click();
    await cashier.getByRole('textbox', { name: 'Float in the drawer' }).fill('100000');
    for (const [chip, quantity] of Object.entries(CHIPS)) {
      await cashier.getByRole('textbox', { name: `${chip} chips` }).fill(quantity);
    }
    await cashier.getByRole('button', { name: 'Open shift' }).click();
    await expect(cashier.getByText('Shift opened.')).toBeVisible();

    await buyIn(cashier);
    await expect(cashier.getByText('₹5,000 of chips issued.')).toBeVisible();
    // At the practice venue the printed receipt says it is a practice one (#69); the printer dialog is the
    // browser's own, so it is left out.
    await cashier.evaluate(() => { globalThis.print = () => undefined; });
    await cashier.getByRole('button', { name: 'Print receipt' }).click();
    await cashier.emulateMedia({ media: 'print' });
    await expect(cashier.getByText('Practice receipt. No money changed hands.')).toBeVisible();
    await cashier.emulateMedia({ media: 'screen' });
    await expect(cashier.getByText(NO_SHIFT)).toHaveCount(0);
  });
});
