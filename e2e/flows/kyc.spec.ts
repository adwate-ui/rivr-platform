/**
 * KYC (#4): a member checks their identity with DigiLocker and sees what was kept: the masked
 * Aadhaar, never the number. The practice venue uses the fake vendor, which consents at once and
 * sends the member straight back; a real venue without vendor keys fails closed (decision 0014).
 */
import { expect, test, type Page } from '@playwright/test';
import { appUrl, isRemoteTarget, VIEWPORT } from '../support/apps.ts';

const CODE = isRemoteTarget() ? (process.env.E2E_SIGN_IN_CODE ?? '') : '123456';

async function signIn(page: Page, number: string) {
  await page.setViewportSize(VIEWPORT.player);
  await page.goto(`${appUrl('player')}/sign-in`);
  await page.getByRole('textbox', { name: 'Mobile number' }).fill(number);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByRole('textbox', { name: /^Code sent to/ }).fill(CODE);
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByRole('heading', { name: 'Tonight' })).toBeVisible();
}

/** Opens Identity and sets off for DigiLocker, unless an earlier run already verified this member. */
async function startKyc(page: Page) {
  await page.goto(`${appUrl('player')}/kyc`);
  const start = page.getByRole('button', { name: 'Continue with DigiLocker' });
  await expect(start.or(page.getByRole('heading', { name: 'Identity verified' }))).toBeVisible();
  if (await start.isVisible()) await start.click();
}

test.describe('KYC', () => {
  test.beforeAll(() => {
    if (CODE === '') throw new Error('E2E_SIGN_IN_CODE is not set: the KYC flow cannot sign in on staging');
  });

  test('a practice-venue member is verified through DigiLocker and sees only the masked Aadhaar', async ({ page }) => {
    await signIn(page, '9000000301');
    await startKyc(page);
    await expect(page.getByRole('heading', { name: 'Identity verified' })).toBeVisible();
    await expect(page.getByText(/^XXXX XXXX \d{4}$/)).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Tonight' })).toBeVisible();
  });

  test('a real venue without a KYC vendor fails closed', async ({ page }) => {
    await signIn(page, '9000000201');
    await startKyc(page);
    await expect(page.getByText('Identity checks are not open yet. Staff will check your documents at the club.')).toBeVisible();
  });
});
