/**
 * Hand entry on the dealer tablet (#42; design prompt flows 4 and 5). Each flow signs in on the
 * console as its own duty manager (Auth sends one code a minute to a number), sets Pema Lepcha's
 * PIN, pairs a tablet and fixes it to Table 3; Pema signs in on the tablet, and:
 * - Log a hand: a ₹48,000 Hold'em pot shows rake ₹2,400, drop ₹100 and pull ₹2,500, and is logged;
 * - A pot at the cap: ₹1,40,010 is refused as not whole chips; ₹1,40,000 of PLO is raked ₹6,000, capped.
 * The tablet is revoked at the end. The ledger side (Table 3's rake rises, the jackpot reaches
 * ₹3,42,700) is proved in supabase/tests/037_log_hand.test.sql; the TV and Home read it with #65 and #87.
 */
import { expect, test } from '@playwright/test';
import { isRemoteTarget } from '../support/apps.ts';
import { signInToConsole } from '../support/signIn.ts';
import { dealerSignsIn, press, revoke, tabletAtTable3 } from '../support/tablet.ts';

test.describe('Hand entry', () => {
  test.beforeEach(() => {
    test.skip(isRemoteTarget(), 'makes a device login, takes Table 3 and logs hands, so the local stack only');
    test.setTimeout(90_000);
  });

  test('Log a hand: a ₹48,000 Hold\'em pot shows rake ₹2,400, drop ₹100 and pull ₹2,500, and is logged', async ({ browser }) => {
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000113');
    const { tablet, name } = await tabletAtTable3(browser, floor);
    await dealerSignsIn(tablet);
    await press(tablet, ['4', '8', '000']);
    await expect(tablet.getByText('₹48,000', { exact: true })).toBeVisible();
    await expect(tablet.getByText('₹2,400', { exact: true })).toBeVisible();
    await expect(tablet.getByText('₹100', { exact: true })).toBeVisible();
    await expect(tablet.getByText('₹2,500', { exact: true })).toBeVisible();
    await tablet.getByRole('button', { name: 'Log hand' }).click();
    await expect(tablet.getByText('Hands this down: 1')).toBeVisible();
    await expect(tablet.getByText(/^\d{2}:\d{2} · Hold'em$/)).toBeVisible();
    await expect(tablet.getByText('₹48,000', { exact: true })).toBeVisible();
    await expect(tablet.getByText('₹2,500', { exact: true })).toHaveCount(0);
    await revoke(floor, name);
  });

  test('A pot at the cap: ₹1,40,010 is not whole chips; ₹1,40,000 of PLO is raked ₹6,000, capped', async ({ browser }) => {
    const floor = await browser.newPage();
    await signInToConsole(floor, '9000000114');
    const { tablet, name } = await tabletAtTable3(browser, floor);
    await dealerSignsIn(tablet);
    await tablet.getByRole('button', { name: 'PLO', exact: true }).click();
    await press(tablet, ['1', '4', '0', '0', '1', '0']);
    await tablet.getByRole('button', { name: 'Log hand' }).click();
    await expect(tablet.getByText('A pot is whole ₹50 chips, up to ₹1 crore. ₹1,40,010 is not.')).toBeVisible();
    await press(tablet, ['Delete', 'Delete', '0', '0']);
    await expect(tablet.getByText('₹1,40,000', { exact: true })).toBeVisible();
    await expect(tablet.getByText('₹6,000', { exact: true })).toBeVisible();
    await expect(tablet.getByText('Capped at ₹6,000')).toBeVisible();
    await expect(tablet.getByText('₹6,100', { exact: true })).toBeVisible();
    await tablet.getByRole('button', { name: 'Log hand' }).click();
    await expect(tablet.getByText('Hands this down: 1')).toBeVisible();
    await expect(tablet.getByText(/^\d{2}:\d{2} · PLO$/)).toBeVisible();
    // The next hand starts as Hold'em, and the chips say so.
    await expect(tablet.getByRole('button', { name: 'Hold\'em', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(tablet.getByRole('button', { name: 'PLO', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await revoke(floor, name);
  });
});
