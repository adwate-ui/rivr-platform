/**
 * KYC (#4, #5): a member takes a selfie, checks their identity with DigiLocker and sees what was
 * kept: the masked Aadhaar, never the number. The practice venue uses the fake vendor, which consents at once and
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

/** A plain JPEG made in the page: the practice venue's fake vendor passes any selfie. */
async function selfie(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 640;
    canvas.getContext('2d')?.fillRect(0, 0, 480, 640);
    return canvas.toDataURL('image/jpeg');
  });
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

/** Opens Identity and takes the selfie, unless an earlier run already took it. */
async function takeSelfie(page: Page) {
  await page.goto(`${appUrl('player')}/kyc`);
  const take = page.getByRole('button', { name: 'Take a selfie' });
  const start = page.getByRole('button', { name: 'Continue with DigiLocker' });
  await expect(take.or(start).or(page.getByRole('heading', { name: 'Identity verified' }))).toBeVisible();
  if (!(await take.isVisible())) return;
  const chooser = page.waitForEvent('filechooser');
  await take.click();
  await (await chooser).setFiles({ name: 'selfie.jpg', mimeType: 'image/jpeg', buffer: await selfie(page) });
}

/** After the selfie, sets off for DigiLocker, unless an earlier run already verified this member. */
async function startDigiLocker(page: Page) {
  const start = page.getByRole('button', { name: 'Continue with DigiLocker' });
  await expect(start.or(page.getByRole('heading', { name: 'Identity verified' }))).toBeVisible();
  if (await start.isVisible()) await start.click();
}

test.describe('KYC', () => {
  test.beforeAll(() => {
    if (CODE === '') throw new Error('E2E_SIGN_IN_CODE is not set: the KYC flow cannot sign in on staging');
  });

  test('a practice-venue member is verified with a selfie and DigiLocker in under three minutes', async ({ page }) => {
    const began = Date.now();
    await signIn(page, '9000000301');
    await takeSelfie(page);
    await startDigiLocker(page);
    await expect(page.getByRole('heading', { name: 'Identity verified' })).toBeVisible();
    await expect(page.getByText(/^XXXX XXXX \d{4}$/)).toBeVisible();
    expect(Date.now() - began).toBeLessThan(180_000);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Tonight' })).toBeVisible();
  });

  test('a real venue without a KYC vendor fails closed', async ({ page }) => {
    await signIn(page, '9000000201');
    await takeSelfie(page);
    await expect(page.getByText('Identity checks are not open yet. Staff will check your documents at the club.')).toBeVisible();
  });
});
