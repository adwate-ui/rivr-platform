/**
 * End of day (#45), in the practice venue. Pooja Nair, this flow's own cashier, opened its shift with
 * ₹1,00,000 of float and the chips counted (the seed's, 70_cage_shift.sql, since the cage takes no money
 * without one, #376). She closes it on End of day with the drawer ₹500 short: the close is an anomaly, and
 * Pooja may not give its reason. Rahul Verma, the floor manager, gives it on his own console, and the close
 * shows it. After this, the Cage shift flow (open-shift.spec.ts) opens the practice cage's next shift, which
 * the Paper fallback flow then uses. A clean close, the figures the ledger expects and who sees what are
 * proved in supabase/tests/069. A local rerun needs `pnpm db:reset` first; CI always starts fresh.
 * It shares the practice cage's one shift with open-shift.spec.ts and paper-fallback.spec.ts: the three carry the
 * @practice-cage tag, and CI runs them together, in that order, on one runner (decision 0243).
 */
import { expect, test, type Page } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';

const CHIPS: Record<string, string> = { '₹50': '100', '₹100': '100', '₹500': '20', '₹1,000': '10', '₹5,000': '4', '₹25,000': '0' };
const REASON = 'A ₹500 note paid out twice; seen on the camera';

async function signInToPractice(page: Page, number: string) {
  await signInToConsole(page, number);
  const rail = page.getByRole('complementary');
  await rail.getByRole('switch', { name: 'Practice venue' }).click();
  await expect(rail.getByText('RIVR Practice')).toBeVisible();
}

async function countChips(page: Page) {
  for (const [chip, quantity] of Object.entries(CHIPS)) {
    await page.getByRole('textbox', { name: `${chip} chips` }).fill(quantity);
  }
}

test.describe('End of day', { tag: '@practice-cage' }, () => {
  test('End of day: Pooja closes the practice cage ₹500 short, an anomaly whose reason Rahul gives', async ({ browser }) => {
    test.skip(isRemoteTarget(), 'closes the practice cage\'s shift, so the local stack only');
    test.setTimeout(120_000);
    const pooja = await browser.newPage();
    await signInToPractice(pooja, '9000000141');
    await pooja.getByRole('link', { name: 'Shift', exact: true }).click();
    await pooja.getByRole('link', { name: 'Closing and history' }).click();
    await expect(pooja.getByRole('heading', { name: 'Closing and history', level: 2 })).toBeVisible();
    await pooja.getByRole('textbox', { name: 'Cash in the drawer' }).fill('99500');
    await pooja.getByRole('textbox', { name: 'UPI and bank receipts' }).fill('0');
    await pooja.getByRole('textbox', { name: 'Signed markers held' }).fill('0');
    await countChips(pooja);
    await pooja.getByRole('button', { name: 'Close shift' }).click();
    await expect(pooja.getByText('Shift closed. Its figures are below.')).toBeVisible();
    await expect(pooja.getByText('Counted ₹99,500 · expected ₹1,00,000 · variance −₹500')).toBeVisible();
    await expect(pooja.getByText('Variance. The day closes once a manager gives the reason.')).toBeVisible();
    await expect(pooja.getByText('A manager who neither opened nor closed this shift gives the reason.')).toBeVisible();
    await expect(pooja.getByRole('textbox', { name: 'Reason for the variance' })).toHaveCount(0);

    const rahul = await browser.newPage();
    await signInToPractice(rahul, '9000000142');
    await rahul.getByRole('link', { name: 'Shift', exact: true }).click();
    await rahul.getByRole('link', { name: 'Closing and history' }).click();
    await rahul.getByRole('textbox', { name: 'Reason for the variance' }).fill(REASON);
    await rahul.getByRole('button', { name: 'Record reason' }).click();
    await expect(rahul.getByText(`Reviewed by Rahul Verma: ${REASON}`)).toBeVisible();
  });
});
