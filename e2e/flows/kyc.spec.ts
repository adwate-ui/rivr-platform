/**
 * KYC (#4, #5): a member takes a selfie, checks their identity with DigiLocker and sees what was
 * kept: the masked Aadhaar, never the number. The practice venue uses the fake vendor, which consents at once and
 * sends the member straight back; a real venue without vendor keys fails closed (decision 0014). Staging has
 * Cashfree's sandbox keys (#474, decision 0197), so there the real venue's check goes to Cashfree instead.
 */
import { expect, test, type Page } from '@playwright/test';
import { localSupabaseEnv } from '@rivr/config/worktree';
import { appUrl, isRemoteTarget } from '../support/apps.ts';
import { serviceRoleKey } from '../support/serviceRole.ts';
import { signInToPlayer } from '../support/signIn.ts';

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
  test('a practice-venue member is verified with a selfie and DigiLocker in under three minutes', async ({ page }) => {
    const began = Date.now();
    await signInToPlayer(page, '9000000301', '/kyc');
    await takeSelfie(page);
    await startDigiLocker(page);
    await expect(page.getByRole('heading', { name: 'Identity verified' })).toBeVisible();
    await expect(page.getByText(/^XXXX XXXX \d{4}$/)).toBeVisible();
    expect(Date.now() - began).toBeLessThan(180_000);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Tonight' })).toBeVisible();
  });

  test('a real venue without a KYC vendor fails closed', async ({ page }) => {
    await signInToPlayer(page, '9000000218', '/kyc');
    // Until the check is done the member sees only its steps (#632): Home sends them back to it.
    await page.goto(appUrl('player'));
    await expect(page).toHaveURL(/\/kyc$/);
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
    // Staging's real venue has Cashfree's sandbox keys, so its KYC is open, not closed: it is proved locally.
    if (isRemoteTarget()) return;
    await takeSelfie(page);
    await expect(page.getByText('Not open yet. Staff check your documents at the club.')).toBeVisible();
  });

  test('a member DigiLocker failed for can try it again from the PAN step; one it matched without a PAN is not offered it', async ({ browser, page, request }) => {
    test.skip(isRemoteTarget(), 'fails a member\'s DigiLocker with the service role, so the local stack only');
    // Shreya Mittal set off for DigiLocker (seed: started) and it failed, as the kyc function records it with the service
    // role: a PAN check with no date of birth. Once failed, failing again changes nothing.
    const { url } = localSupabaseEnv();
    const service = serviceRoleKey();
    const failed = await request.post(`${url}/rest/v1/rpc/record_kyc_digilocker_failed`, {
      headers: { apikey: service, authorization: `Bearer ${service}`, 'content-type': 'application/json' },
      data: { p_member_id: '00000000-0000-4000-8000-000000000403' },
    });
    expect(failed.ok(), await failed.text()).toBe(true);
    await signInToPlayer(page, '9000000403', '/kyc');
    await expect(page.getByRole('heading', { name: 'PAN', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Try DigiLocker again' }).click();
    // The seed keeps no selfie for her, so the kyc function refuses the start and the step says so. A member who reached
    // the PAN step in the app took the selfie first.
    await expect(page.getByText('Identity checks are down. Try again shortly.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'PAN', level: 1 })).toBeVisible();

    // Shivam Kalra's DigiLocker matched but held no PAN (seed: needs_pan with his date of birth): the PAN alone verifies him.
    const matched = await browser.newPage();
    await signInToPlayer(matched, '9000000442', '/kyc');
    await expect(matched.getByRole('heading', { name: 'PAN', level: 1 })).toBeVisible();
    await expect(matched.getByRole('button', { name: 'Verify' })).toBeVisible();
    await expect(matched.getByRole('button', { name: 'Try DigiLocker again' })).toHaveCount(0);
  });
});
